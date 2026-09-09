"""Strict recipes for two research modules on one content-pinned Mika base."""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_MODEL = ROOT / 'public/avatar/mika-milfy-12.vrm'
SOURCE_MANIFEST = ROOT / 'public/avatar/mika-milfy-12.parts.json'
CATALOG_PATH = Path(__file__).parent / 'validation/modules/catalog.json'
MODULE_ORDER = ('face-jaw-v1', 'hair-bob-v1')
CONTRACT_VERSION = 1


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load_catalog():
    with CATALOG_PATH.open(encoding='utf-8') as handle:
        catalog = json.load(handle)
    require(type(catalog.get('schemaVersion')) is int and catalog['schemaVersion'] == CONTRACT_VERSION,
            'unsupported catalog version')
    require(len(catalog['modules']) == len(MODULE_ORDER) and
            {module['moduleId'] for module in catalog['modules']} == set(MODULE_ORDER),
            'catalog contains unsupported builders')
    return catalog


def validate_parameters(parameters, spec):
    require(isinstance(parameters, dict), 'parameters must be an object')
    definitions = spec['parameters']
    require(set(parameters) <= set(definitions), 'unknown module parameter')
    normalised = {}
    for name, limits in definitions.items():
        value = parameters.get(name, limits['default'])
        require(type(value) in (int, float) and math.isfinite(value), f'{name} must be finite numeric data')
        require(limits['min'] <= value <= limits['max'], f'{name} outside allowed range')
        normalised[name] = float(value)
    return normalised


def validate_selection(selected, available):
    require(isinstance(selected, dict) and set(selected) == {'moduleId', 'moduleVersion', 'parameters'},
            'module selection fields must be moduleId, moduleVersion, parameters')
    module_id = selected['moduleId']
    require(isinstance(module_id, str) and module_id in available, 'unknown module ID')
    spec = available[module_id]
    require(type(selected['moduleVersion']) is int and selected['moduleVersion'] == spec['moduleVersion'],
            'unsupported module version')
    return {'moduleId': module_id, 'moduleVersion': spec['moduleVersion'],
            'parameters': validate_parameters(selected['parameters'], spec)}


def validate_recipe(recipe, catalog=None):
    catalog = load_catalog() if catalog is None else catalog
    require(isinstance(recipe, dict) and set(recipe) == {'schemaVersion', 'baseId', 'modules'},
            'recipe fields must be schemaVersion, baseId, modules')
    require(type(recipe['schemaVersion']) is int and recipe['schemaVersion'] == CONTRACT_VERSION,
            'unsupported recipe version')
    require(recipe['baseId'] == catalog['base']['baseId'], 'incompatible base ID')
    require(isinstance(recipe['modules'], list), 'modules must be an array')
    available = {module['moduleId']: module for module in catalog['modules']}
    selected = [validate_selection(value, available) for value in recipe['modules']]
    kinds = [available[value['moduleId']]['kind'] for value in selected]
    require(len(kinds) == len(set(kinds)), 'only one module of each kind is allowed')
    selected.sort(key=lambda value: MODULE_ORDER.index(value['moduleId']))
    return {'schemaVersion': CONTRACT_VERSION, 'baseId': recipe['baseId'], 'modules': selected}


def verify_sources(catalog=None):
    catalog = load_catalog() if catalog is None else catalog
    actual = {'modelSha256': sha256(SOURCE_MODEL), 'manifestSha256': sha256(SOURCE_MANIFEST)}
    for name, value in actual.items():
        require(value == catalog['base'][name], f'base {name} hash mismatch')
    return actual
