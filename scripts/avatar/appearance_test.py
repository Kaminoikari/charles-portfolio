"""Regression checks for the two appearance defects visible in the browser."""
import io
import json
import os
import sys
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402


BASE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(BASE, '..', '..', 'public', 'avatar', 'mika-milfy.vrm')
MANIFEST = MODEL.replace('.vrm', '.parts.json')
SKIN_MAX_CHANNEL = 222
SKIN_MIN_CHROMA = 40
HAIR_MAX_CHANNEL = 208
HAIR_MIN_CHROMA = 40
SKIN_FACTOR_MAX = 0.96
HAIR_FACTOR_MAX = 0.92
MATERIAL_FACTOR_MIN_CHROMA = 0.08
THIGH_BAND_DIAMETER_RATIO_MIN = 1.0
THIGH_BAND_DIAMETER_RATIO_MAX = 1.15


class AppearanceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc, binary = glb.load(MODEL)
        cls.views = glb.views_of(cls.doc, binary)
        with open(MANIFEST, encoding='utf-8') as manifest_file:
            cls.manifest = json.load(manifest_file)

    def texture_median(self, name):
        image = next(image for image in self.doc['images'] if image.get('name') == name)
        rgba = np.asarray(
            Image.open(io.BytesIO(bytes(self.views[image['bufferView']]))).convert('RGBA'),
            dtype=np.float64,
        )
        return np.median(rgba[..., :3][rgba[..., 3] > 200], axis=0)

    def part_points(self, name, material_name=None):
        part = self.manifest['parts'][name]
        mesh = next(mesh for mesh in self.doc['meshes'] if mesh.get('name') == part['mesh'])
        return np.concatenate([
            glb.read_accessor(
                self.doc,
                self.views,
                mesh['primitives'][primitive]['attributes']['POSITION'],
            )
            for primitive in part['primitives']
            if material_name is None
            or self.doc['materials'][mesh['primitives'][primitive]['material']]['name']
            == material_name
        ])

    def textured_materials(self, image_prefix):
        image_indices = {
            index for index, image in enumerate(self.doc['images'])
            if image.get('name', '').startswith(image_prefix)
        }
        texture_indices = {
            index for index, texture in enumerate(self.doc['textures'])
            if texture.get('source') in image_indices
        }
        return [
            (material, self.doc['extensions']['VRM']['materialProperties'][index])
            for index, material in enumerate(self.doc['materials'])
            if material.get('pbrMetallicRoughness', {})
            .get('baseColorTexture', {}).get('index') in texture_indices
        ]

    def assert_material_tone(self, image_prefix, max_factor):
        materials = self.textured_materials(image_prefix)
        self.assertTrue(materials, f'找不到 {image_prefix} 的材質')
        for material, properties in materials:
            base = material['pbrMetallicRoughness']['baseColorFactor'][:3]
            vectors = properties['vectorProperties']
            color = vectors['_Color'][:3]
            shade = vectors['_ShadeColor'][:3]
            self.assertEqual(base, color, material['name'])
            self.assertEqual(base, shade, material['name'])
            has_visible_tone = (max(base) <= max_factor
                                and max(base) - min(base)
                                >= MATERIAL_FACTOR_MIN_CHROMA)
            self.assertTrue(has_visible_tone, f'{material["name"]} 乘色為 {base}')

    def test_skin_texture_keeps_visible_tone_under_mtoon_lighting(self):
        median = self.texture_median('F00_000_00_Body_00')
        has_natural_tone = (float(median.max()) <= SKIN_MAX_CHANNEL
                            and float(np.ptp(median)) >= SKIN_MIN_CHROMA)
        self.assertTrue(has_natural_tone, f'膚色中位數為 {median}')

    def test_hair_texture_keeps_visible_tone_under_mtoon_lighting(self):
        median = self.texture_median('F00_000_Hair_00_01')
        has_natural_tone = (float(median.max()) <= HAIR_MAX_CHANNEL
                            and float(np.ptp(median)) >= HAIR_MIN_CHROMA)
        self.assertTrue(has_natural_tone, f'髮色中位數為 {median}')

    def test_skin_material_preserves_tone_after_live_exposure(self):
        self.assert_material_tone('F00_000_00_Face_00', SKIN_FACTOR_MAX)
        self.assert_material_tone('F00_000_00_Body_00', SKIN_FACTOR_MAX)

    def test_hair_material_preserves_tone_after_live_exposure(self):
        self.assert_material_tone('F00_000_Hair_00_', HAIR_FACTOR_MAX)

    def test_thigh_band_diameter_matches_the_thigh(self):
        band = self.part_points('Acc_Bandage_Thigh', 'Mellow_Leg_Acc')
        skin = self.part_points('Body_Skin')
        side = np.sign(float(np.median(band[:, 0])))
        same_thigh = (
            (np.sign(skin[:, 0]) == side)
            & (skin[:, 1] >= band[:, 1].min())
            & (skin[:, 1] <= band[:, 1].max())
        )
        thigh = skin[same_thigh]
        band_diameter = np.ptp(band[:, [0, 2]], axis=0)
        thigh_diameter = np.ptp(thigh[:, [0, 2]], axis=0)
        ratio = band_diameter / thigh_diameter
        is_fitted = ((ratio >= THIGH_BAND_DIAMETER_RATIO_MIN)
                     & (ratio <= THIGH_BAND_DIAMETER_RATIO_MAX)).all()
        self.assertTrue(is_fitted, f'腿帶／大腿直徑比為 {ratio}')


if __name__ == '__main__':
    unittest.main()
