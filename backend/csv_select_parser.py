"""
CSV Select List Parser for TTL/RDF Ontology Generation

Supports:
- 1D flat select lists (simple dropdown)
- 2D hierarchical select lists (manufacturer > model)
- Automatic TTL generation with aliases and phonetics
- CSV format validation and error handling

CSV Formats:
1D: label,value,aliases,phonetics
2D: category,label,value,aliases,phonetics
"""

import csv
import io
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass


@dataclass
class SelectOption:
    """Represents a single select option"""
    label: str
    value: str
    aliases: List[str] = None
    phonetics: List[str] = None
    category: Optional[str] = None  # For hierarchical selects
    ontology_uri: Optional[str] = None

    def __post_init__(self):
        if self.aliases is None:
            self.aliases = []
        if self.phonetics is None:
            self.phonetics = []


class CSVSelectParser:
    """Parse CSV files into select options"""

    @staticmethod
    def parse_1d_csv(csv_content: str) -> Tuple[List[SelectOption], List[str]]:
        """
        Parse 1D CSV format (flat list)

        Format: label,value,aliases,phonetics
        Example:
        Third Party Only,third_party,"Third Party|TP|TPO","Tee Pee Oh"
        """
        options = []
        errors = []

        try:
            reader = csv.DictReader(io.StringIO(csv_content))

            # Check headers
            expected_headers = {'label', 'value'}
            if not expected_headers.issubset(set(reader.fieldnames or [])):
                errors.append(f"Missing required headers. Expected at least: {expected_headers}")
                return [], errors

            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                try:
                    label = row.get('label', '').strip()
                    value = row.get('value', '').strip()

                    if not label or not value:
                        errors.append(f"Row {row_num}: Label and value are required")
                        continue

                    # Parse aliases (pipe-separated)
                    aliases_str = row.get('aliases', '').strip()
                    aliases = [a.strip() for a in aliases_str.split('|') if a.strip()] if aliases_str else []

                    # Parse phonetics (pipe-separated)
                    phonetics_str = row.get('phonetics', '').strip()
                    phonetics = [p.strip() for p in phonetics_str.split('|') if p.strip()] if phonetics_str else []

                    options.append(SelectOption(
                        label=label,
                        value=value,
                        aliases=aliases,
                        phonetics=phonetics
                    ))

                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")

        except Exception as e:
            errors.append(f"CSV parsing error: {str(e)}")

        return options, errors

    @staticmethod
    def parse_2d_csv(csv_content: str) -> Tuple[Dict[str, List[SelectOption]], List[str]]:
        """
        Parse 2D CSV format (hierarchical list)

        Format: category,label,value,aliases,phonetics
        Example:
        Toyota,Corolla,toyota_corolla,"Toyota Corolla|Corolla","Tee Oh Why Oh Tee Eh"
        Toyota,Camry,toyota_camry,"Toyota Camry|Camry",""
        BMW,3 Series,bmw_3_series,"BMW 3|3 Series","Bee Em Double You Three"
        """
        hierarchical_options = {}
        errors = []

        try:
            reader = csv.DictReader(io.StringIO(csv_content))

            # Check headers
            expected_headers = {'category', 'label', 'value'}
            if not expected_headers.issubset(set(reader.fieldnames or [])):
                errors.append(f"Missing required headers. Expected at least: {expected_headers}")
                return {}, errors

            for row_num, row in enumerate(reader, start=2):
                try:
                    category = row.get('category', '').strip()
                    label = row.get('label', '').strip()
                    value = row.get('value', '').strip()

                    if not category or not label or not value:
                        errors.append(f"Row {row_num}: Category, label, and value are required")
                        continue

                    # Parse aliases
                    aliases_str = row.get('aliases', '').strip()
                    aliases = [a.strip() for a in aliases_str.split('|') if a.strip()] if aliases_str else []

                    # Parse phonetics
                    phonetics_str = row.get('phonetics', '').strip()
                    phonetics = [p.strip() for p in phonetics_str.split('|') if p.strip()] if phonetics_str else []

                    option = SelectOption(
                        label=label,
                        value=value,
                        aliases=aliases,
                        phonetics=phonetics,
                        category=category
                    )

                    if category not in hierarchical_options:
                        hierarchical_options[category] = []

                    hierarchical_options[category].append(option)

                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")

        except Exception as e:
            errors.append(f"CSV parsing error: {str(e)}")

        return hierarchical_options, errors

    @staticmethod
    def generate_ttl_1d(options: List[SelectOption], question_id: str,
                        namespace_prefix: str = "ins") -> str:
        """
        Generate TTL/RDF for 1D select options

        Returns TTL snippet to be inserted into ontology file
        """
        ttl_lines = []
        ttl_lines.append(f"# Select options for {question_id}")
        ttl_lines.append("")

        for idx, option in enumerate(options):
            option_uri = f":{question_id}Option{idx + 1}"

            ttl_lines.append(f"{option_uri} a :SelectOption ;")
            ttl_lines.append(f'    rdfs:label "{option.label}" ;')
            ttl_lines.append(f'    :optionValue "{option.value}" ;')
            ttl_lines.append(f'    :optionLabel "{option.label}" ;')

            if option.aliases:
                aliases_str = '", "'.join(option.aliases)
                ttl_lines.append(f'    :optionAlias "{aliases_str}" ;')

            if option.phonetics:
                phonetics_str = '", "'.join(option.phonetics)
                ttl_lines.append(f'    :optionPhonetic "{phonetics_str}" ;')

            ttl_lines.append(f'    :forQuestion :{question_id} .')
            ttl_lines.append("")

        # Add hasOption relationships to question
        ttl_lines.append(f":{question_id}")
        for idx in range(len(options)):
            option_uri = f":{question_id}Option{idx + 1}"
            if idx == len(options) - 1:
                ttl_lines.append(f"    :hasOption {option_uri} .")
            else:
                ttl_lines.append(f"    :hasOption {option_uri} ;")

        return "\n".join(ttl_lines)

    @staticmethod
    def generate_ttl_2d(hierarchical_options: Dict[str, List[SelectOption]],
                       question_id: str, namespace_prefix: str = "ins") -> str:
        """
        Generate TTL/RDF for 2D hierarchical select options

        Returns TTL snippet with optgroup structure
        """
        ttl_lines = []
        ttl_lines.append(f"# Hierarchical select options for {question_id}")
        ttl_lines.append("")

        all_option_uris = []

        for category_idx, (category, options) in enumerate(hierarchical_options.items()):
            # Create optgroup
            optgroup_uri = f":{question_id}OptGroup{category_idx + 1}"
            ttl_lines.append(f"{optgroup_uri} a :SelectOptGroup ;")
            ttl_lines.append(f'    rdfs:label "{category}" ;')
            ttl_lines.append(f'    :groupLabel "{category}" ;')

            # Add options to this group
            option_uris = []
            for option_idx, option in enumerate(options):
                option_uri = f":{question_id}OptGroup{category_idx + 1}Option{option_idx + 1}"
                option_uris.append(option_uri)
                all_option_uris.append(option_uri)

            for idx, uri in enumerate(option_uris):
                if idx == len(option_uris) - 1:
                    ttl_lines.append(f"    :hasOption {uri} .")
                else:
                    ttl_lines.append(f"    :hasOption {uri} ;")

            ttl_lines.append("")

            # Define each option
            for option_idx, option in enumerate(options):
                option_uri = f":{question_id}OptGroup{category_idx + 1}Option{option_idx + 1}"

                ttl_lines.append(f"{option_uri} a :SelectOption ;")
                ttl_lines.append(f'    rdfs:label "{option.label}" ;')
                ttl_lines.append(f'    :optionValue "{option.value}" ;')
                ttl_lines.append(f'    :optionLabel "{option.label}" ;')
                ttl_lines.append(f'    :optionCategory "{category}" ;')

                if option.aliases:
                    aliases_str = '", "'.join(option.aliases)
                    ttl_lines.append(f'    :optionAlias "{aliases_str}" ;')

                if option.phonetics:
                    phonetics_str = '", "'.join(option.phonetics)
                    ttl_lines.append(f'    :optionPhonetic "{phonetics_str}" ;')

                ttl_lines.append(f'    :inOptGroup {optgroup_uri} .')
                ttl_lines.append("")

        # Add hasOptGroup relationships to question
        ttl_lines.append(f":{question_id}")
        for category_idx in range(len(hierarchical_options)):
            optgroup_uri = f":{question_id}OptGroup{category_idx + 1}"
            if category_idx == len(hierarchical_options) - 1:
                ttl_lines.append(f"    :hasOptGroup {optgroup_uri} .")
            else:
                ttl_lines.append(f"    :hasOptGroup {optgroup_uri} ;")

        return "\n".join(ttl_lines)

    @staticmethod
    def generate_example_csv_1d() -> str:
        """Generate example 1D CSV template"""
        return """label,value,aliases,phonetics
Comprehensive,comprehensive,"Comprehensive|Comp|Fully Comp","Comp|Fully Comprehensive"
Third Party Fire and Theft,third_party_fire_theft,"TPFT|Third Party Fire Theft","Tee Pee Eff Tee"
Third Party Only,third_party,"Third Party|TP|TPO","Tee Pee Oh"
"""

    @staticmethod
    def generate_example_csv_2d() -> str:
        """Generate example 2D CSV template"""
        return """category,label,value,aliases,phonetics
Toyota,Corolla,toyota_corolla,"Toyota Corolla|Corolla",""
Toyota,Camry,toyota_camry,"Toyota Camry|Camry",""
Toyota,RAV4,toyota_rav4,"Toyota RAV4|RAV4|RAV Four","Are Ay Vee Four"
BMW,3 Series,bmw_3_series,"BMW 3|3 Series|BMW Three Series","Bee Em Double You Three"
BMW,5 Series,bmw_5_series,"BMW 5|5 Series|BMW Five Series","Bee Em Double You Five"
BMW,X5,bmw_x5,"BMW X5|X Five","Bee Em Double You Ex Five"
Mercedes,C-Class,mercedes_c_class,"Mercedes C|C-Class|C Class","Mercedes See Class"
Mercedes,E-Class,mercedes_e_class,"Mercedes E|E-Class|E Class","Mercedes Ee Class"
Mercedes,GLC,mercedes_glc,"Mercedes GLC|GLC|G L C","Mercedes Gee El See"
"""


def main():
    """Test the CSV parser"""
    parser = CSVSelectParser()

    print("=" * 80)
    print("1D CSV Example (Cover Types)")
    print("=" * 80)
    csv_1d = parser.generate_example_csv_1d()
    print(csv_1d)

    options_1d, errors_1d = parser.parse_1d_csv(csv_1d)
    if errors_1d:
        print("Errors:", errors_1d)
    else:
        print(f"\nParsed {len(options_1d)} options")
        ttl_1d = parser.generate_ttl_1d(options_1d, "CoverTypeQuestion")
        print("\nGenerated TTL:")
        print(ttl_1d)

    print("\n" + "=" * 80)
    print("2D CSV Example (Car Manufacturer & Model)")
    print("=" * 80)
    csv_2d = parser.generate_example_csv_2d()
    print(csv_2d)

    options_2d, errors_2d = parser.parse_2d_csv(csv_2d)
    if errors_2d:
        print("Errors:", errors_2d)
    else:
        print(f"\nParsed {len(options_2d)} categories")
        for category, opts in options_2d.items():
            print(f"  {category}: {len(opts)} options")

        ttl_2d = parser.generate_ttl_2d(options_2d, "CarModelQuestion")
        print("\nGenerated TTL:")
        print(ttl_2d[:500] + "..." if len(ttl_2d) > 500 else ttl_2d)


if __name__ == "__main__":
    main()
