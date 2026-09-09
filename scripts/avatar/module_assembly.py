"""Compose explicitly selected research modules without publishing any assets."""
import json
from pathlib import Path

import customise
import glb
import module_contract as contract

OUTPUT_ROOT = contract.ROOT / 'build/mika-phase2'


def apply_face(doc, views, manifest, parameters):
    import face_module
    return face_module.apply(doc, views, manifest, parameters)


def apply_hair(doc, views, manifest, parameters):
    import hair_module
    return hair_module.apply(doc, views, manifest, parameters)


BUILDERS = {'face-jaw-v1': apply_face, 'hair-bob-v1': apply_hair}


def reserve_directory(directory):
    directory = Path(directory).absolute()
    allowed = OUTPUT_ROOT.absolute()
    contract.require('..' not in directory.parts, 'output traversal is not allowed')
    contract.require(directory != allowed and directory.is_relative_to(allowed), 'output must be below the fixed phase2 directory')
    for path in (directory, *directory.parents):
        contract.require(not path.is_symlink(), f'symlink output path: {path}')
    contract.require(directory.resolve().is_relative_to(allowed.resolve()), 'output path escapes phase2 directory')
    directory.mkdir(parents=True, exist_ok=False)
    return directory


def write_json(path, value):
    with path.open('x', encoding='utf-8') as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, allow_nan=False)
        handle.write('\n')


def assemble_modules(recipe, catalog, doc, views, manifest):
    specs = {spec['moduleId']: spec for spec in catalog['modules']}
    reports = []
    for module in recipe['modules']:
        module_id = module['moduleId']
        result = BUILDERS[module_id](doc, views, manifest, module['parameters'])
        contract.require(isinstance(result, dict), f'{module_id} did not return its build report')
        reports.append({**module, 'kind': specs[module_id]['kind'], 'status': 'research_only',
                        'rigFamily': specs[module_id]['rigFamily'],
                        'morphPolicy': specs[module_id]['morphPolicy'],
                        'staticHead': specs[module_id]['staticHead'],
                        'contract': specs[module_id],
                        'licenceStatus': specs[module_id]['licenceStatus'], 'buildReport': result})
    return reports


def apply(recipe, directory):
    """Write one fresh candidate directory; return paths and research metadata.

    The caller owns technical and visual verification. Successful serialization
    establishes no quality, likeness, licensing or target-app certification.
    """
    catalog = contract.load_catalog()
    recipe = contract.validate_recipe(recipe, catalog)
    sources = contract.verify_sources(catalog)
    directory = reserve_directory(directory)
    doc, binary = glb.load(str(contract.SOURCE_MODEL))
    views = glb.views_of(doc, binary)
    with contract.SOURCE_MANIFEST.open(encoding='utf-8') as handle:
        manifest = json.load(handle)
    modules = assemble_modules(recipe, catalog, doc, views, manifest)
    customise.sweep_materials(doc)
    views, _ = customise.sweep(doc, views)
    customise.remap(doc, manifest)
    customise.sync_palette(doc, manifest)
    metadata = {'schemaVersion': 1, 'baseId': recipe['baseId'], 'status': 'research_only',
                'sources': sources, 'modules': modules, 'catalogSha256': contract.sha256(contract.CATALOG_PATH),
                'technicalValidation': 'NOT_RUN', 'visualAcceptance': 'NOT_RUN',
                'targetApp': 'NOT_RUN', 'licenceStatus': 'PENDING_FOR_CUSTOMER_DISTRIBUTION'}
    manifest['moduleAssembly'] = metadata
    model_path, manifest_path = directory / 'model.vrm', directory / 'model.parts.json'
    glb.save(str(model_path), doc, glb.rebuild(doc, views))
    write_json(manifest_path, manifest)
    write_json(directory / 'recipe.json', recipe)
    contract.require(contract.verify_sources(catalog) == sources, 'source changed during assembly')
    return {'model': str(model_path), 'manifest': str(manifest_path),
            'recipe': str(directory / 'recipe.json'), 'metadata': metadata,
            'modelSha256': contract.sha256(model_path), 'manifestSha256': contract.sha256(manifest_path)}
