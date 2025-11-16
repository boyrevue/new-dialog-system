"""
HTML Select Parser for Ontology Generation

Parses HTML select elements and generates TTL/RDF ontology entries
Supports both 1D and 2D (hierarchical) select options
"""

import re
from html.parser import HTMLParser
from typing import List, Dict, Tuple
import sys


class SelectOptionParser(HTMLParser):
    """Parse HTML select element and extract options"""

    def __init__(self):
        super().__init__()
        self.options = []
        self.current_optgroup = None
        self.in_option = False
        self.current_option = {}

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        if tag == 'optgroup':
            # Handle optgroup for hierarchical selects
            self.current_optgroup = attrs_dict.get('label', '')

        elif tag == 'option':
            self.in_option = True
            self.current_option = {
                'value': attrs_dict.get('value', ''),
                'label': '',
                'selected': 'selected' in attrs_dict,
                'disabled': 'disabled' in attrs_dict,
                'optgroup': self.current_optgroup
            }

    def handle_endtag(self, tag):
        if tag == 'option' and self.in_option:
            self.options.append(self.current_option.copy())
            self.in_option = False
            self.current_option = {}
        elif tag == 'optgroup':
            self.current_optgroup = None

    def handle_data(self, data):
        if self.in_option:
            self.current_option['label'] = data.strip()


def parse_html_select(html: str) -> List[Dict]:
    """
    Parse HTML select element and return list of options

    Args:
        html: HTML string containing select element

    Returns:
        List of dicts with keys: value, label, selected, disabled, optgroup
    """
    parser = SelectOptionParser()
    parser.feed(html)
    return parser.options


def sanitize_uri_component(text: str) -> str:
    """
    Sanitize text for use in URIs
    - Remove special characters
    - Replace spaces with underscores
    - Convert to CamelCase
    """
    # Remove HTML entities and special chars
    text = re.sub(r'[^\w\s-]', '', text)
    # Convert to CamelCase
    words = text.replace('-', ' ').replace('_', ' ').split()
    return ''.join(word.capitalize() for word in words)


def generate_ttl_ontology(options: List[Dict],
                          select_id: str = None,
                          namespace_prefix: str = 'sel',
                          namespace_uri: str = 'http://select.example.org/ontology#',
                          include_optgroups: bool = True) -> str:
    """
    Generate TTL ontology from parsed select options

    Args:
        options: List of option dicts from parse_html_select()
        select_id: ID of the select element (e.g., 'CarParkingTypeId')
        namespace_prefix: Prefix for the ontology namespace
        namespace_uri: URI for the ontology namespace
        include_optgroups: Whether to create optgroup hierarchy

    Returns:
        TTL/RDF ontology string
    """
    if not select_id:
        select_id = 'SelectOptions'

    # Sanitize select_id for URI
    select_uri_id = sanitize_uri_component(select_id)

    ttl = []

    # Prefixes
    ttl.append(f"@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .")
    ttl.append(f"@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .")
    ttl.append(f"@prefix owl: <http://www.w3.org/2002/07/owl#> .")
    ttl.append(f"@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .")
    ttl.append(f"@prefix skos: <http://www.w3.org/2004/02/skos/core#> .")
    ttl.append(f"@prefix {namespace_prefix}: <{namespace_uri}> .")
    ttl.append("")

    # Ontology header
    ttl.append(f"# ============================================================================")
    ttl.append(f"# {select_uri_id.upper()} ONTOLOGY")
    ttl.append(f"# Generated from HTML select element")
    ttl.append(f"# ============================================================================")
    ttl.append("")

    ttl.append(f"<{namespace_uri}>")
    ttl.append(f"    a owl:Ontology ;")
    ttl.append(f"    rdfs:label \"{select_uri_id} Ontology\"@en ;")
    ttl.append(f"    rdfs:comment \"Generated from HTML select #{select_id}\"@en ;")
    ttl.append(f"    owl:versionInfo \"1.0\" .")
    ttl.append("")

    # Create SKOS ConceptScheme
    ttl.append(f"# ============================================================================")
    ttl.append(f"# CONCEPT SCHEME")
    ttl.append(f"# ============================================================================")
    ttl.append("")
    ttl.append(f"{namespace_prefix}:{select_uri_id}Scheme a skos:ConceptScheme ;")
    ttl.append(f"    rdfs:label \"{select_uri_id} Options\"@en ;")
    ttl.append(f"    skos:prefLabel \"{select_uri_id}\"@en .")
    ttl.append("")

    # Group options by optgroup
    optgroups = {}
    ungrouped = []

    for option in options:
        if option['value'] in ['-1', '', None]:  # Skip "Select" placeholder
            continue

        if option['optgroup'] and include_optgroups:
            if option['optgroup'] not in optgroups:
                optgroups[option['optgroup']] = []
            optgroups[option['optgroup']].append(option)
        else:
            ungrouped.append(option)

    # Generate optgroup concepts if present
    if optgroups and include_optgroups:
        ttl.append(f"# ============================================================================")
        ttl.append(f"# OPTION GROUPS")
        ttl.append(f"# ============================================================================")
        ttl.append("")

        for group_name in optgroups.keys():
            group_uri = sanitize_uri_component(group_name)
            ttl.append(f"{namespace_prefix}:{group_uri} a skos:Collection ;")
            ttl.append(f"    rdfs:label \"{group_name}\"@en ;")
            ttl.append(f"    skos:prefLabel \"{group_name}\"@en .")
            ttl.append("")

    # Generate option concepts
    ttl.append(f"# ============================================================================")
    ttl.append(f"# OPTIONS")
    ttl.append(f"# ============================================================================")
    ttl.append("")

    # Process ungrouped options
    for option in ungrouped:
        value = option['value']
        label = option['label']
        uri_component = sanitize_uri_component(label) or f"Option{value}"

        ttl.append(f"{namespace_prefix}:{uri_component} a skos:Concept ;")
        ttl.append(f"    skos:prefLabel \"{label}\"@en ;")
        ttl.append(f"    skos:notation \"{value}\" ;")
        ttl.append(f"    skos:inScheme {namespace_prefix}:{select_uri_id}Scheme .")
        ttl.append("")

    # Process grouped options
    for group_name, group_options in optgroups.items():
        group_uri = sanitize_uri_component(group_name)
        ttl.append(f"# {group_name}")
        ttl.append("")

        for option in group_options:
            value = option['value']
            label = option['label']
            uri_component = sanitize_uri_component(label) or f"Option{value}"

            ttl.append(f"{namespace_prefix}:{uri_component} a skos:Concept ;")
            ttl.append(f"    skos:prefLabel \"{label}\"@en ;")
            ttl.append(f"    skos:notation \"{value}\" ;")
            ttl.append(f"    skos:inScheme {namespace_prefix}:{select_uri_id}Scheme ;")
            if include_optgroups:
                ttl.append(f"    skos:member {namespace_prefix}:{group_uri} .")
            else:
                ttl.append(f"    .")
            ttl.append("")

    return '\n'.join(ttl)


def main():
    """
    Command-line usage:
    python html_select_parser.py < input.html > output.ttl

    or

    python html_select_parser.py "select_id" "namespace_prefix" < input.html > output.ttl
    """
    # Read HTML from stdin
    html_input = sys.stdin.read()

    # Parse command-line arguments
    select_id = sys.argv[1] if len(sys.argv) > 1 else None
    namespace_prefix = sys.argv[2] if len(sys.argv) > 2 else 'sel'

    # Extract select_id from HTML if not provided
    if not select_id:
        id_match = re.search(r'id="([^"]+)"', html_input)
        if id_match:
            select_id = id_match.group(1)

    # Parse options
    options = parse_html_select(html_input)

    # Generate TTL
    ttl = generate_ttl_ontology(
        options,
        select_id=select_id,
        namespace_prefix=namespace_prefix
    )

    # Output to stdout
    print(ttl)


if __name__ == '__main__':
    # Example usage demonstration
    example_html = '''
    <select id="VehicleInformation_CarParkingTypeId" name="VehicleInformation.CarParkingTypeId">
        <option selected="selected" value="-1">Select</option>
        <option value="1">Garaged</option>
        <option value="2">Driveway</option>
        <option value="3">Road</option>
        <option value="4">Residents' off-road parking area</option>
        <option value="5">Residents' off-road gated parking area</option>
        <option value="6">Locked underground parking area</option>
        <option value="16">Car Park</option>
    </select>
    '''

    if len(sys.argv) == 1:
        # Demo mode
        print("# DEMO MODE - Example output:")
        print("# To use: python html_select_parser.py < input.html > output.ttl")
        print()
        options = parse_html_select(example_html)
        ttl = generate_ttl_ontology(
            options,
            select_id='VehicleInformation_CarParkingTypeId',
            namespace_prefix='parking',
            namespace_uri='http://parking.example.org/ontology#'
        )
        print(ttl)
    else:
        # Normal mode
        main()
