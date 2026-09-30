from xml.etree import ElementTree


def requires_entity_segment(label_config):
    """Match the aggregate backend: OCR/documents use Seed only."""
    try:
        root = ElementTree.fromstring(label_config)
    except (ElementTree.ParseError, TypeError):
        return False
    images = {tag.get('name'): tag for tag in root.iter('Image')}
    ocr_targets = {tag.get('toName') for tag in root.iter('TextArea')}
    for kind in ('BrushLabels', 'PolygonLabels', 'RectangleLabels'):
        for control in root.iter(kind):
            target = control.get('toName')
            image = images.get(target)
            if image is None or target in ocr_targets:
                continue
            if kind == 'RectangleLabels' and image.get('valueList'):
                continue
            return True
    return False
