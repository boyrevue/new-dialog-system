"""
Dialog Manager - Core dialog flow management with TTL-based configuration
All configuration loaded from TTL ontologies via SPARQL queries
"""

import rdflib
from rdflib import Graph, Namespace, URIRef, Literal
from rdflib.plugins.sparql import prepareQuery
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define namespaces
DIALOG = Namespace("http://diggi.io/ontology/dialog#")
MM = Namespace("http://diggi.io/ontology/multimodal#")
CONF = Namespace("http://diggi.io/ontology/confidence#")
QC = Namespace("http://diggi.io/ontology/quality-control#")
VOCAB = Namespace("http://diggi.io/ontology/vocabularies#")
DOC = Namespace("http://diggi.io/ontology/documents#")
FORM = Namespace("http://diggi.io/ontology/forms#")
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")
OWL = Namespace("http://www.w3.org/2002/07/owl#")
SH = Namespace("http://www.w3.org/ns/shacl#")


class DialogManager:
    """
    Core dialog manager that loads all configuration from TTL ontologies.
    NO HARDCODED VALUES - everything comes from the golden source (TTL files).
    """
    
    def __init__(self, ontology_paths: List[str]):
        """
        Initialize dialog manager by loading TTL ontologies.
        
        Args:
            ontology_paths: List of paths to TTL ontology files
        """
        self.graph = Graph()
        
        # Bind namespaces
        self.graph.bind("dialog", DIALOG)
        self.graph.bind("mm", MM)
        self.graph.bind("conf", CONF)
        self.graph.bind("qc", QC)
        self.graph.bind("vocab", VOCAB)
        self.graph.bind("doc", DOC)
        self.graph.bind("form", FORM)
        self.graph.bind("skos", SKOS)
        self.graph.bind("sh", SH)
        
        # Load all ontology files
        for path in ontology_paths:
            try:
                self.graph.parse(path, format="turtle")
                logger.info(f"Loaded ontology: {path}")
            except Exception as e:
                logger.error(f"Failed to load ontology {path}: {e}")
                raise
        
        # Cache for TTL configuration
        self._ttl_config = None
        self._confidence_thresholds = {}
        self._recording_config = None
        
        logger.info(f"Dialog manager initialized with {len(self.graph)} triples")
    
    def get_ttl_configuration(self) -> Dict[str, timedelta]:
        """
        Load TTL configuration from ontology (golden source).
        Returns cache lifetimes for different entity types.
        """
        if self._ttl_config is None:
            query = prepareQuery("""
                SELECT ?sessionTTL ?answerTTL ?recordingTTL
                WHERE {
                    ?config a dialog:TTLConfiguration ;
                            dialog:sessionTTL ?sessionTTL ;
                            dialog:answerTTL ?answerTTL ;
                            dialog:recordingTTL ?recordingTTL .
                }
                LIMIT 1
            """, initNs={"dialog": DIALOG})
            
            results = list(self.graph.query(query))
            if results:
                row = results[0]
                self._ttl_config = {
                    "session": self._parse_duration(str(row.sessionTTL)),
                    "answer": self._parse_duration(str(row.answerTTL)),
                    "recording": self._parse_duration(str(row.recordingTTL))
                }
            else:
                raise ValueError("No TTL configuration found in ontology")
        
        return self._ttl_config
    
    def _parse_duration(self, duration_str: str) -> timedelta:
        """Parse XSD duration string to timedelta."""
        # Simple parser for common patterns like PT30M, PT10M, P7D
        if duration_str.startswith("PT"):
            # Time duration
            duration_str = duration_str[2:]
            if duration_str.endswith("M"):
                minutes = int(duration_str[:-1])
                return timedelta(minutes=minutes)
            elif duration_str.endswith("H"):
                hours = int(duration_str[:-1])
                return timedelta(hours=hours)
        elif duration_str.startswith("P"):
            # Date duration
            duration_str = duration_str[1:]
            if duration_str.endswith("D"):
                days = int(duration_str[:-1])
                return timedelta(days=days)
        
        raise ValueError(f"Unsupported duration format: {duration_str}")
    
    def get_dialog_flow(self, dialog_id: str) -> List[Dict]:
        """
        Load dialog flow from ontology.
        Returns ordered list of dialog nodes including questions in sections.
        Questions are sorted by section order first, then by question order within section.
        Supports both :sectionOrder and :order properties for sections (fallback).
        """
        query = prepareQuery("""
            SELECT ?node ?nodeType ?questionId ?questionText ?slotName ?required ?spellingRequired ?order ?sectionOrder ?section
            WHERE {
                {
                    # Direct nodes attached to dialog (welcome messages, etc.)
                    # These have sectionOrder 0 to appear first
                    ?dialog a dialog:Dialog ;
                            dialog:hasNode ?node .
                    ?node dialog:order ?order .
                    FILTER NOT EXISTS { ?node dialog:inSection ?anySection }
                    BIND(0 AS ?sectionOrder)
                    BIND("" AS ?section)

                    OPTIONAL {
                        ?node a ?nodeType .
                        FILTER(?nodeType = dialog:Question || ?nodeType = mm:MultimodalQuestion)
                    }

                    OPTIONAL {
                        ?node dialog:questionId ?questionId ;
                              dialog:questionText ?questionText ;
                              dialog:slotName ?slotName ;
                              dialog:required ?required .
                        OPTIONAL { ?node dialog:spellingRequired ?spellingRequired . }
                    }
                }
                UNION
                {
                    # Questions that belong to sections - order by section order, then question order
                    # Supports both :sectionOrder (preferred) and :order (fallback) for section ordering
                    ?dialog a dialog:Dialog ;
                            dialog:hasNode ?section .
                    ?section a dialog:Section .
                    OPTIONAL { ?section dialog:sectionOrder ?secOrder . }
                    OPTIONAL { ?section dialog:order ?secFallbackOrder . }
                    BIND(COALESCE(?secOrder, ?secFallbackOrder, 999) AS ?sectionOrder)
                    ?node dialog:inSection ?section ;
                          dialog:order ?order .

                    OPTIONAL {
                        ?node a ?nodeType .
                        FILTER(?nodeType = dialog:Question || ?nodeType = mm:MultimodalQuestion)
                    }

                    OPTIONAL {
                        ?node dialog:questionId ?questionId ;
                              dialog:questionText ?questionText ;
                              dialog:slotName ?slotName ;
                              dialog:required ?required .
                        OPTIONAL { ?node dialog:spellingRequired ?spellingRequired . }
                    }
                }
            }
            ORDER BY ?sectionOrder ?order
        """, initNs={"dialog": DIALOG, "mm": MM})

        results = self.graph.query(query)

        nodes = []
        for row in results:
            node_data = {
                "node_uri": str(row.node),
                "order": int(row.order) if row.order else 0,
                "section_order": int(row.sectionOrder) if row.sectionOrder else 0,
                "node_type": str(row.nodeType) if row.nodeType else "Node"
            }

            if row.questionId:
                node_data.update({
                    "question_id": str(row.questionId),
                    "question_text": str(row.questionText),
                    "slot_name": str(row.slotName),
                    "required": bool(row.required),
                    "spelling_required": bool(row.spellingRequired) if row.spellingRequired else False
                })

            nodes.append(node_data)

        # Sort by section order first, then by question order within section
        return sorted(nodes, key=lambda x: (x["section_order"], x["order"]))
    
    def get_multimodal_features(self, question_id: str) -> Dict:
        """
        Load multimodal features for a question from ontology.
        Includes TTS prompts, visual components, select options, and FAQs.
        """
        query = prepareQuery("""
            SELECT ?question ?ttsPrompt ?ttsText ?ttsVoice ?ttsRate ?ttsPitch ?ttsConfig
                   ?ttsVariant1 ?ttsVariant2 ?ttsVariant3 ?ttsVariant4
                   ?visual ?componentType ?imageUrl ?componentData
                   ?option ?optionValue ?optionLabel ?optionDesc ?optionAlias ?optionPhonetic ?optionOrder
                   ?faq ?faqQuestion ?faqAnswer ?faqCategory
            WHERE {
                ?question dialog:questionId ?qid .
                FILTER(str(?qid) = ?questionIdLiteral)

                OPTIONAL {
                    ?question mm:hasTTSPrompt ?ttsPrompt .
                    ?ttsPrompt mm:ttsText ?ttsText .
                    OPTIONAL { ?ttsPrompt mm:ttsVoice ?ttsVoice . }
                    OPTIONAL { ?ttsPrompt mm:ttsRate ?ttsRate . }
                    OPTIONAL { ?ttsPrompt mm:ttsPitch ?ttsPitch . }
                    OPTIONAL { ?ttsPrompt mm:ttsConfig ?ttsConfig . }
                    OPTIONAL { ?ttsPrompt mm:ttsVariant1 ?ttsVariant1 . }
                    OPTIONAL { ?ttsPrompt mm:ttsVariant2 ?ttsVariant2 . }
                    OPTIONAL { ?ttsPrompt mm:ttsVariant3 ?ttsVariant3 . }
                    OPTIONAL { ?ttsPrompt mm:ttsVariant4 ?ttsVariant4 . }
                }
                
                OPTIONAL {
                    ?question mm:hasVisualComponent ?visual .
                    ?visual mm:componentType ?componentType .
                    OPTIONAL { ?visual mm:imageUrl ?imageUrl . }
                    OPTIONAL { ?visual mm:componentData ?componentData . }
                }
                
                OPTIONAL {
                    {
                        ?question mm:hasOption ?option .
                        ?option mm:optionValue ?optionValue ;
                                mm:optionLabel ?optionLabel .
                        OPTIONAL { ?option mm:optionDescription ?optionDesc . }
                        OPTIONAL { ?option mm:optionAlias ?optionAlias . }
                        OPTIONAL { ?option mm:optionPhonetic ?optionPhonetic . }
                        OPTIONAL { ?option mm:optionOrder ?optionOrder . }
                    }
                    UNION
                    {
                        ?option dialog:belongsToQuestion ?question .
                        ?option dialog:optionValue ?optionValue ;
                                dialog:optionLabel ?optionLabel .
                        OPTIONAL { ?option dialog:optionDescription ?optionDesc . }
                        OPTIONAL { ?option dialog:optionAlias ?optionAlias . }
                        OPTIONAL { ?option dialog:optionPhonetic ?optionPhonetic . }
                        OPTIONAL { ?option dialog:optionOrder ?optionOrder . }
                    }
                }
                
                OPTIONAL {
                    ?question mm:hasFAQ ?faq .
                    ?faq mm:faqQuestion ?faqQuestion ;
                         mm:faqAnswer ?faqAnswer .
                    OPTIONAL { ?faq mm:faqCategory ?faqCategory . }
                }
            }
        """, initNs={"dialog": DIALOG, "mm": MM})
        
        results = self.graph.query(query, initBindings={"questionIdLiteral": Literal(question_id)})
        
        features = {
            "tts": None,
            "visual_components": [],
            "select_options": [],
            "faqs": [],
            "cascading": {
                "is_dependent": False,
                "parent_question_id": None
            }
        }
        
        for row in results:
            # TTS Prompt
            if row.ttsPrompt and not features["tts"]:
                features["tts"] = {
                    "text": str(row.ttsText),
                    "voice": str(row.ttsVoice) if row.ttsVoice else "en-GB-Neural2-A",
                    "rate": float(row.ttsRate) if row.ttsRate else 1.0,
                    "pitch": float(row.ttsPitch) if row.ttsPitch else 1.0,
                    "config": str(row.ttsConfig) if row.ttsConfig else "standard"
                }
                # Add variants if they exist
                if row.ttsVariant1:
                    features["tts"]["variant1"] = str(row.ttsVariant1)
                if row.ttsVariant2:
                    features["tts"]["variant2"] = str(row.ttsVariant2)
                if row.ttsVariant3:
                    features["tts"]["variant3"] = str(row.ttsVariant3)
                if row.ttsVariant4:
                    features["tts"]["variant4"] = str(row.ttsVariant4)
            
            # Visual Components
            if row.visual:
                visual = {
                    "type": str(row.componentType),
                }
                if row.imageUrl:
                    visual["image_url"] = str(row.imageUrl)
                if row.componentData:
                    visual["data"] = str(row.componentData)
                
                if visual not in features["visual_components"]:
                    features["visual_components"].append(visual)
            
            # Select Options (collect with aliases and phonetics)
            if row.option:
                option_id = str(row.option)
                # Find existing option or create new
                existing_option = next(
                    (opt for opt in features["select_options"] if opt.get("_id") == option_id),
                    None
                )

                if not existing_option:
                    existing_option = {
                        "_id": option_id,
                        "value": str(row.optionValue),
                        "label": str(row.optionLabel),
                        "aliases": [],
                        "phonetics": [],
                        "order": int(row.optionOrder) if hasattr(row, 'optionOrder') and row.optionOrder else 999
                    }
                    if row.optionDesc:
                        existing_option["description"] = str(row.optionDesc)
                    features["select_options"].append(existing_option)

                # Add aliases and phonetics
                if hasattr(row, 'optionAlias') and row.optionAlias:
                    alias = str(row.optionAlias)
                    if alias not in existing_option["aliases"]:
                        existing_option["aliases"].append(alias)

                if hasattr(row, 'optionPhonetic') and row.optionPhonetic:
                    phonetic = str(row.optionPhonetic)
                    if phonetic not in existing_option["phonetics"]:
                        existing_option["phonetics"].append(phonetic)
            
            # FAQs
            if row.faq:
                faq = {
                    "question": str(row.faqQuestion),
                    "answer": str(row.faqAnswer),
                }
                if row.faqCategory:
                    faq["category"] = str(row.faqCategory)
                
                if faq not in features["faqs"]:
                    features["faqs"].append(faq)

        # Sort select options by order, then clean up internal fields
        features["select_options"].sort(key=lambda x: x.get("order", 999))
        for option in features["select_options"]:
            option.pop("_id", None)
            option.pop("order", None)  # Remove order field after sorting

        # Fallback: If there are select options but no input_type, set it to "select"
        if features.get("select_options") and not features.get("input_type"):
            features["input_type"] = "select"
            logger.debug(f"Auto-detected input_type=select for {question_id} based on {len(features['select_options'])} select options")

        return features

    def get_select_options_for_question(self, question_id: str, parent_value: Optional[str] = None) -> List[Dict]:
        """
        Get select options for a question from the ontology.
        Supports two formats:
        1. mm:selectOptions - RDF list like ("Male" "Female" "Other")
        2. mm:hasOption - Individual option objects with properties
        Returns list of options with label and value.
        """
        from rdflib.collection import Collection
        from rdflib import RDF

        # First, find ALL question nodes by question_id (may be defined in multiple ontology files)
        question_nodes = list(self.graph.subjects(DIALOG.questionId, Literal(question_id)))

        if not question_nodes:
            logger.warning(f"Question not found for id: {question_id}")
            return []

        logger.debug(f"Found {len(question_nodes)} question nodes for {question_id}: {[str(n) for n in question_nodes]}")

        options = []

        # Format 1: Try mm:selectOptions (RDF list format) - check all question nodes
        options_list_node = None
        for question_node in question_nodes:
            for obj in self.graph.objects(question_node, MM.selectOptions):
                options_list_node = obj
                break
            if options_list_node:
                break

        if options_list_node:
            try:
                options_collection = Collection(self.graph, options_list_node)
                for item in options_collection:
                    option_value = str(item)
                    options.append({
                        "label": option_value,
                        "value": option_value.lower().replace(" ", "_"),
                        "ontologyUri": ""
                    })
                logger.info(f"Found {len(options)} select options (RDF list) for {question_id}: {[o['label'] for o in options]}")
                return options
            except Exception as e:
                logger.error(f"Error parsing selectOptions for {question_id}: {e}")

        # Format 2: Try mm:hasOption OR mm:hasSelectOption (individual option objects)
        # Some questions use mm:hasOption, others use mm:hasSelectOption
        # Check ALL question nodes for options
        option_nodes = []
        for question_node in question_nodes:
            option_nodes.extend(list(self.graph.objects(question_node, MM.hasOption)))
            option_nodes.extend(list(self.graph.objects(question_node, MM.hasSelectOption)))

        # Format 3: ALSO try dialog:belongsToQuestion (reverse relationship - option points to question)
        # Always check this format in addition to Format 2, to catch options from all sources
        for question_node in question_nodes:
            option_nodes.extend(list(self.graph.subjects(DIALOG.belongsToQuestion, question_node)))

        # Deduplicate by ontology URI to avoid duplicate options
        seen_uris = set()
        unique_option_nodes = []
        for node in option_nodes:
            uri = str(node)
            if uri not in seen_uris:
                seen_uris.add(uri)
                unique_option_nodes.append(node)
        option_nodes = unique_option_nodes

        for option_node in option_nodes:
            option = {"label": "", "value": "", "ontologyUri": str(option_node), "order": 999}

            # Get option label (try mm: first, then dialog:)
            for label in self.graph.objects(option_node, MM.optionLabel):
                option["label"] = str(label)
                break
            if not option["label"]:
                for label in self.graph.objects(option_node, DIALOG.optionLabel):
                    option["label"] = str(label)
                    break

            # Get option value (try mm: first, then dialog:)
            for value in self.graph.objects(option_node, MM.optionValue):
                option["value"] = str(value)
                break
            if not option["value"]:
                for value in self.graph.objects(option_node, DIALOG.optionValue):
                    option["value"] = str(value)
                    break

            # Get option description (optional, try mm: first, then dialog:)
            for desc in self.graph.objects(option_node, MM.optionDescription):
                option["description"] = str(desc)
                break
            if "description" not in option:
                for desc in self.graph.objects(option_node, DIALOG.optionDescription):
                    option["description"] = str(desc)
                    break

            # Get option aliases (optional, try mm: first, then dialog:)
            aliases = []
            for alias in self.graph.objects(option_node, MM.optionAlias):
                aliases.append(str(alias))
            if not aliases:
                for alias in self.graph.objects(option_node, DIALOG.optionAlias):
                    aliases.append(str(alias))
            if aliases:
                option["aliases"] = aliases

            # Get option phonetics (optional, try mm: first, then dialog:)
            phonetics = []
            for phonetic in self.graph.objects(option_node, MM.optionPhonetic):
                phonetics.append(str(phonetic))
            if not phonetics:
                for phonetic in self.graph.objects(option_node, DIALOG.optionPhonetic):
                    phonetics.append(str(phonetic))
            if phonetics:
                option["phonetics"] = phonetics

            # Get option order (optional, try mm: first, then dialog:)
            for order in self.graph.objects(option_node, MM.optionOrder):
                option["order"] = int(order)
                break
            if option["order"] == 999:
                for order in self.graph.objects(option_node, DIALOG.optionOrder):
                    option["order"] = int(order)
                    break

            # Get dependency value (optional)
            for dep in self.graph.objects(option_node, MM.dependsOnValue):
                option["parent_value"] = str(dep)
                break

            if option["label"] or option["value"]:
                options.append(option)

        if options:
            # Filter by parent value if provided
            if parent_value:
                original_count = len(options)
                options = [o for o in options if o.get("parent_value") == parent_value]
                logger.info(f"Filtered options for {question_id} by parent={parent_value}: {original_count} -> {len(options)}")

            # Sort by order
            options.sort(key=lambda x: x.get("order", 999))

            # Clean up internal order field
            for opt in options:
                opt.pop("order", None)

            logger.info(f"Found {len(options)} select options for {question_id}: {[o['label'] for o in options]}")
        else:
            logger.debug(f"No select options found for question: {question_id}")

        return options

    def get_input_mode(self, question_id: str) -> Optional[Dict]:
        """
        Load input mode configuration from SKOS vocabulary.
        Returns dict with spelling settings or None.
        """
        query = prepareQuery("""
            SELECT ?inputMode ?supportsSpelling ?terminationKeyword ?timeout ?usesSeparator
            WHERE {
                ?question dialog:questionId ?qid .
                FILTER(str(?qid) = ?questionIdLiteral)

                OPTIONAL {
                    ?question dialog:hasInputMode ?inputMode .
                    OPTIONAL { ?inputMode vocab:supportsLetterByLetterSpelling ?supportsSpelling . }
                    OPTIONAL { ?inputMode vocab:spellingTerminationKeyword ?terminationKeyword . }
                    OPTIONAL { ?inputMode vocab:spellingTimeout ?timeout . }
                    OPTIONAL { ?inputMode vocab:usesSpaceSeparator ?usesSeparator . }
                }
            }
        """, initNs={"dialog": DIALOG, "vocab": VOCAB})

        results = list(self.graph.query(query, initBindings={"questionIdLiteral": Literal(question_id)}))

        if results and results[0].inputMode:
            row = results[0]
            # Extract input type from URI (e.g., "vocab:DateInputMode" -> "date")
            input_mode_uri = str(row.inputMode)
            input_type = None
            if 'DateInputMode' in input_mode_uri:
                input_type = 'date'
            elif 'SelectInputMode' in input_mode_uri:
                input_type = 'select'
            elif 'NameInputMode' in input_mode_uri:
                input_type = 'name'
            elif 'EmailInputMode' in input_mode_uri:
                input_type = 'email'
            elif 'VehicleRegInputMode' in input_mode_uri:
                input_type = 'vehicle_reg'
            elif 'DrivingLicenceInputMode' in input_mode_uri:
                input_type = 'uk_driving_licence'

            return {
                "uri": input_mode_uri,
                "input_type": input_type,
                "supports_letter_by_letter": bool(row.supportsSpelling) if row.supportsSpelling else False,
                "termination_keyword": str(row.terminationKeyword) if row.terminationKeyword else "end",
                "timeout_seconds": int(row.timeout) if row.timeout else 5,
                "uses_space_separator": bool(row.usesSeparator) if row.usesSeparator else True
            }

        return None

    def get_section_for_question(self, question_id: str) -> Optional[Dict]:
        """
        Get section information for a question from ontology.
        Returns section title, description, and order.
        """
        query = prepareQuery("""
            SELECT ?section ?sectionTitle ?sectionDescription ?sectionOrder ?sectionLabel
            WHERE {
                ?question dialog:questionId ?qid .
                FILTER(str(?qid) = ?questionIdLiteral)

                OPTIONAL {
                    ?question dialog:inSection ?section .
                    OPTIONAL { ?section dialog:sectionTitle ?sectionTitle . }
                    OPTIONAL { ?section dialog:sectionDescription ?sectionDescription . }
                    OPTIONAL { ?section dialog:order ?sectionOrder . }
                    OPTIONAL { ?section rdfs:label ?sectionLabel . }
                }
            }
        """, initNs={"dialog": DIALOG, "rdfs": rdflib.RDFS})

        results = list(self.graph.query(query, initBindings={"questionIdLiteral": Literal(question_id)}))

        if results and results[0].section:
            row = results[0]
            return {
                "section_uri": str(row.section),
                "section_title": str(row.sectionTitle) if row.sectionTitle else str(row.sectionLabel) if row.sectionLabel else None,
                "section_description": str(row.sectionDescription) if row.sectionDescription else None,
                "section_order": int(row.sectionOrder) if row.sectionOrder else None
            }

        return None

    def get_document_fillable(self, question_id: str) -> dict:
        """
        Get whether a question can be auto-filled from document upload and the document name.
        Returns dict with 'fillable' (bool) and 'document_name' (str or None).
        """
        query = prepareQuery("""
            SELECT ?documentFillable ?documentLabel
            WHERE {
                ?question dialog:questionId ?qid .
                FILTER(str(?qid) = ?questionIdLiteral)

                OPTIONAL {
                    ?question mm:documentFillable ?documentFillable .
                }
                OPTIONAL {
                    ?question dialog:extractableFrom ?document .
                    ?document rdfs:label ?documentLabel .
                }
            }
            LIMIT 1
        """, initNs={"dialog": DIALOG, "mm": MM, "rdfs": RDFS})

        results = list(self.graph.query(query, initBindings={"questionIdLiteral": Literal(question_id)}))

        if results and results[0].documentFillable:
            # Get the document label from the :extractableFrom property
            document_name = str(results[0].documentLabel) if results[0].documentLabel else None

            return {
                "fillable": True,
                "document_name": document_name
            }

        return {
            "fillable": False,
            "document_name": None
        }

    def get_form_definition(self, question_id: str) -> Optional[dict]:
        """
        Get form definition for a question if it has a :hasForm property.
        Returns form structure with fields, validations, and transformers.
        """
        query = prepareQuery("""
            SELECT ?form ?formId ?formTitle ?formDescription ?successMsg ?onSubmit
            WHERE {
                ?question dialog:questionId ?qid .
                FILTER(str(?qid) = ?questionIdLiteral)

                OPTIONAL {
                    ?question dialog:hasForm ?form .
                    ?form form:formId ?formId ;
                          form:formTitle ?formTitle .

                    OPTIONAL { ?form form:formDescription ?formDescription . }
                    OPTIONAL { ?form form:successMessage ?successMsg . }
                    OPTIONAL { ?form form:onSubmitAction ?onSubmit . }
                }
            }
            LIMIT 1
        """, initNs={"dialog": DIALOG, "form": FORM})

        results = list(self.graph.query(query, initBindings={"questionIdLiteral": Literal(question_id)}))

        if not results or not results[0].form:
            return None

        row = results[0]
        form_uri = row.form

        # Get field groups
        field_groups = self._get_field_groups(form_uri)

        return {
            "form_id": str(row.formId),
            "form_title": str(row.formTitle),
            "form_description": str(row.formDescription) if row.formDescription else None,
            "success_message": str(row.successMsg) if row.successMsg else None,
            "on_submit_action": str(row.onSubmit) if row.onSubmit else "next_question",
            "field_groups": field_groups
        }

    def _get_field_groups(self, form_uri) -> List[dict]:
        """Get all field groups for a form."""
        query = prepareQuery("""
            SELECT ?fieldGroup ?groupId ?groupTitle ?groupOrder ?minOccurs ?maxOccurs
            WHERE {
                ?form form:hasFieldGroup ?fieldGroup .
                FILTER(?form = ?formUri)

                ?fieldGroup form:fieldGroupId ?groupId ;
                           form:fieldGroupTitle ?groupTitle ;
                           form:fieldGroupOrder ?groupOrder .

                OPTIONAL { ?fieldGroup form:minOccurs ?minOccurs . }
                OPTIONAL { ?fieldGroup form:maxOccurs ?maxOccurs . }
            }
            ORDER BY ?groupOrder
        """, initNs={"form": FORM})

        results = list(self.graph.query(query, initBindings={"formUri": form_uri}))

        field_groups = []
        for row in results:
            fields = self._get_fields(row.fieldGroup)
            field_groups.append({
                "group_id": str(row.groupId),
                "group_title": str(row.groupTitle),
                "group_order": int(row.groupOrder),
                "min_occurs": int(row.minOccurs) if row.minOccurs else 1,
                "max_occurs": int(row.maxOccurs) if row.maxOccurs else 1,
                "fields": fields
            })

        return field_groups

    def _get_fields(self, field_group_uri) -> List[dict]:
        """Get all fields for a field group."""
        query = prepareQuery("""
            SELECT ?field ?fieldId ?fieldLabel ?fieldType ?fieldOrder ?required
                   ?placeholder ?helpText ?uiHint ?defaultValue
            WHERE {
                ?fieldGroup form:hasField ?field .
                FILTER(?fieldGroup = ?fieldGroupUri)

                ?field form:fieldId ?fieldId ;
                       form:fieldLabel ?fieldLabel ;
                       form:fieldType ?fieldType ;
                       form:fieldOrder ?fieldOrder .

                OPTIONAL { ?field form:required ?required . }
                OPTIONAL { ?field form:placeholder ?placeholder . }
                OPTIONAL { ?field form:helpText ?helpText . }
                OPTIONAL { ?field form:uiHint ?uiHint . }
                OPTIONAL { ?field form:defaultValue ?defaultValue . }
            }
            ORDER BY ?fieldOrder
        """, initNs={"form": FORM})

        results = list(self.graph.query(query, initBindings={"fieldGroupUri": field_group_uri}))

        fields = []
        for row in results:
            # Get field type name from URI
            field_type_str = str(row.fieldType).split("#")[-1] if row.fieldType else "TextInput"

            # Get validations and transformers
            validations = self._get_validations(row.field)
            transformers = self._get_transformers(row.field)

            fields.append({
                "field_id": str(row.fieldId),
                "field_label": str(row.fieldLabel),
                "field_type": field_type_str,
                "field_order": int(row.fieldOrder),
                "required": bool(row.required) if row.required else False,
                "placeholder": str(row.placeholder) if row.placeholder else None,
                "help_text": str(row.helpText) if row.helpText else None,
                "ui_hint": str(row.uiHint) if row.uiHint else None,
                "default_value": str(row.defaultValue) if row.defaultValue else None,
                "validations": validations,
                "transformers": transformers
            })

        return fields

    def _get_validations(self, field_uri) -> List[dict]:
        """Get all validation rules for a field."""
        query = prepareQuery("""
            SELECT ?validation ?validationType ?validationValue ?validationMessage
            WHERE {
                ?field form:hasValidation ?validation .
                FILTER(?field = ?fieldUri)

                ?validation form:validationType ?validationType ;
                           form:validationValue ?validationValue .

                OPTIONAL { ?validation form:validationMessage ?validationMessage . }
            }
        """, initNs={"form": FORM})

        results = list(self.graph.query(query, initBindings={"fieldUri": field_uri}))

        validations = []
        for row in results:
            validations.append({
                "type": str(row.validationType),
                "value": str(row.validationValue),
                "message": str(row.validationMessage) if row.validationMessage else None
            })

        return validations

    def _get_transformers(self, field_uri) -> List[dict]:
        """Get all value transformers for a field."""
        query = prepareQuery("""
            SELECT ?transformer ?transformerType ?inputPattern ?outputValue
                   ?transformerOrder ?caseInsensitive
            WHERE {
                ?field form:hasTransformer ?transformer .
                FILTER(?field = ?fieldUri)

                ?transformer form:transformerType ?transformerType ;
                            form:inputPattern ?inputPattern ;
                            form:outputValue ?outputValue .

                OPTIONAL { ?transformer form:transformerOrder ?transformerOrder . }
                OPTIONAL { ?transformer form:caseInsensitive ?caseInsensitive . }
            }
            ORDER BY ?transformerOrder
        """, initNs={"form": FORM})

        results = list(self.graph.query(query, initBindings={"fieldUri": field_uri}))

        transformers = []
        for row in results:
            transformers.append({
                "type": str(row.transformerType),
                "input_pattern": str(row.inputPattern),
                "output_value": str(row.outputValue),
                "order": int(row.transformerOrder) if row.transformerOrder else 0,
                "case_insensitive": bool(row.caseInsensitive) if row.caseInsensitive else False
            })

        return transformers

    def get_confidence_threshold(self, question_id: str) -> Tuple[float, int]:
        """
        Get confidence threshold and review priority for a question from ontology.
        Returns (threshold_value, priority)
        """
        if question_id in self._confidence_thresholds:
            return self._confidence_thresholds[question_id]

        query = prepareQuery("""
            SELECT ?threshold ?priority
            WHERE {
                ?question dialog:questionId ?qid .
                FILTER(str(?qid) = ?questionIdLiteral)

                ?thresholdConfig dialog:appliesTo ?question ;
                                 conf:thresholdValue ?threshold ;
                                 qc:reviewPriority ?priority .
            }
        """, initNs={"dialog": DIALOG, "conf": CONF, "qc": QC})

        results = list(self.graph.query(query, initBindings={"questionIdLiteral": Literal(question_id)}))

        if results:
            row = results[0]
            threshold = float(row.threshold)
            priority = int(row.priority)
            self._confidence_thresholds[question_id] = (threshold, priority)
            return threshold, priority

        # Default fallback (should be configured in TTL)
        logger.warning(f"No confidence threshold found for question {question_id}, using default")
        return 0.70, 5
    
    def get_recording_configuration(self) -> Dict:
        """
        Load audio recording configuration from ontology.
        """
        if self._recording_config is None:
            query = prepareQuery("""
                SELECT ?sampleRate ?bitDepth ?channels ?format ?codec
                WHERE {
                    ?config a qc:RecordingConfiguration ;
                            qc:sampleRate ?sampleRate ;
                            qc:bitDepth ?bitDepth ;
                            qc:channels ?channels ;
                            qc:format ?format ;
                            qc:codec ?codec .
                    FILTER(?config = qc:DefaultRecordingConfig)
                }
            """, initNs={"qc": QC})
            
            results = list(self.graph.query(query))
            if results:
                row = results[0]
                self._recording_config = {
                    "sample_rate": int(row.sampleRate),
                    "bit_depth": int(row.bitDepth),
                    "channels": int(row.channels),
                    "format": str(row.format),
                    "codec": str(row.codec)
                }
            else:
                raise ValueError("No recording configuration found in ontology")
        
        return self._recording_config
    
    def get_rephrase_template(self, question_id: str, template_type: str = "phonetic") -> Dict:
        """
        Get rephrase request template from ontology.
        """
        query = prepareQuery("""
            SELECT ?template ?suggestedRephrase ?ttsConfig
            WHERE {
                ?template a qc:RephraseRequest ;
                          :suggestedRephrase ?suggestedRephrase ;
                          :rephraseTTSConfig ?ttsConfig .
                
                {
                    ?template :appliesTo ?question .
                    ?question dialog:questionId ?qid .
                    FILTER(str(?qid) = ?questionIdLiteral)
                }
                UNION
                {
                    ?template :appliesTo :AllQuestions .
                }
            }
        """, initNs={"dialog": DIALOG, "qc": QC, ":": DIALOG})
        
        results = list(self.graph.query(query, initBindings={"questionIdLiteral": Literal(question_id)}))
        
        if results:
            row = results[0]
            return {
                "template": str(row.suggestedRephrase),
                "tts_config": str(row.ttsConfig)
            }
        
        return {
            "template": "Could you please repeat that more clearly?",
            "tts_config": "standard"
        }
    
    def validate_vocabulary_match(self, input_text: str, concept_scheme: str) -> Optional[str]:
        """
        Match input text against SKOS vocabulary.
        Returns matched concept notation or None.
        """
        query = prepareQuery("""
            SELECT ?concept ?notation
            WHERE {
                ?concept skos:inScheme ?scheme ;
                        skos:notation ?notation .
                
                {
                    ?concept skos:prefLabel ?label .
                    FILTER(lcase(str(?label)) = lcase(?inputText))
                }
                UNION
                {
                    ?concept skos:altLabel ?altLabel .
                    FILTER(lcase(str(?altLabel)) = lcase(?inputText))
                }
                
                FILTER(str(?scheme) = ?schemeLiteral)
            }
        """, initNs={"skos": SKOS})
        
        results = list(self.graph.query(
            query, 
            initBindings={
                "inputText": Literal(input_text.strip()),
                "schemeLiteral": Literal(concept_scheme)
            }
        ))
        
        if results:
            return str(results[0].notation)
        
        return None

    def get_question_metadata(self, question_id: str) -> Dict:
        """
        Get comprehensive question metadata including document extraction info.
        Returns: {
            "mandatory_field": bool,
            "input_type": str,  # "spelling" or "word"
            "data_type": str,   # "alphanumeric", "numeric", "alpha", etc.
            "extractable_from": List[Dict]  # Documents that can provide this field
        }
        """
        query = prepareQuery("""
            SELECT ?mandatoryField ?inputType ?dataType ?docUri ?docLabel ?docType
            WHERE {
                ?question dialog:questionId ?qid .
                FILTER(str(?qid) = ?questionIdLiteral)

                OPTIONAL { ?question dialog:mandatoryField ?mandatoryField . }
                OPTIONAL { ?question dialog:inputType ?inputType . }
                OPTIONAL { ?question dialog:dataType ?dataType . }
                OPTIONAL {
                    ?question dialog:extractableFrom ?docUri .
                    ?docUri rdfs:label ?docLabel .
                    OPTIONAL { ?docUri a ?docType . }
                }
            }
        """, initNs={"dialog": DIALOG, "rdfs": RDFS})

        results = list(self.graph.query(query, initBindings={"questionIdLiteral": Literal(question_id)}))

        if not results:
            return {
                "mandatory_field": False,
                "input_type": "word",
                "data_type": "text",
                "extractable_from": []
            }

        # Get base properties from first row
        first_row = results[0]
        metadata = {
            "mandatory_field": bool(first_row.mandatoryField) if hasattr(first_row, 'mandatoryField') and first_row.mandatoryField else False,
            "input_type": str(first_row.inputType) if hasattr(first_row, 'inputType') and first_row.inputType else "word",
            "data_type": str(first_row.dataType) if hasattr(first_row, 'dataType') and first_row.dataType else "text",
            "extractable_from": []
        }

        # Collect all documents
        seen_docs = set()
        for row in results:
            if hasattr(row, 'docUri') and row.docUri:
                doc_uri = str(row.docUri)
                if doc_uri not in seen_docs:
                    seen_docs.add(doc_uri)
                    doc_info = {
                        "uri": doc_uri,
                        "label": str(row.docLabel) if hasattr(row, 'docLabel') and row.docLabel else doc_uri,
                        "type": str(row.docType) if hasattr(row, 'docType') and row.docType else None
                    }
                    metadata["extractable_from"].append(doc_info)

        return metadata

    def get_all_documents(self) -> List[Dict]:
        """
        Get all available document types from the ontology.
        Returns list of documents with their properties.
        """
        query = prepareQuery("""
            SELECT ?uri ?label ?prefLabel ?type ?requiresOCR ?comment
            WHERE {
                ?uri a doc:Document .
                ?uri rdfs:label ?label .

                OPTIONAL { ?uri skos:prefLabel ?prefLabel . }
                OPTIONAL { ?uri a ?type . FILTER(?type != owl:NamedIndividual && ?type != doc:Document) }
                OPTIONAL { ?uri doc:requiresOCR ?requiresOCR . }
                OPTIONAL { ?uri rdfs:comment ?comment . }
            }
        """, initNs={"doc": DOC, "rdfs": RDFS, "skos": SKOS, "owl": OWL})

        results = self.graph.query(query)

        documents = {}
        for row in results:
            uri = str(row.uri)
            if uri not in documents:
                documents[uri] = {
                    "uri": uri,
                    "label": str(row.label),
                    "pref_label": str(row.prefLabel) if hasattr(row, 'prefLabel') and row.prefLabel else str(row.label),
                    "types": [],
                    "requires_ocr": bool(row.requiresOCR) if hasattr(row, 'requiresOCR') and row.requiresOCR else False,
                    "comment": str(row.comment) if hasattr(row, 'comment') and row.comment else None,
                    "alt_labels": []
                }

            if hasattr(row, 'type') and row.type:
                doc_type = str(row.type)
                if doc_type not in documents[uri]["types"]:
                    documents[uri]["types"].append(doc_type)

        # Get alt labels
        alt_query = prepareQuery("""
            SELECT ?uri ?altLabel
            WHERE {
                ?uri a doc:Document .
                ?uri skos:altLabel ?altLabel .
            }
        """, initNs={"doc": DOC, "skos": SKOS})

        alt_results = self.graph.query(alt_query)
        for row in alt_results:
            uri = str(row.uri)
            if uri in documents and hasattr(row, 'altLabel') and row.altLabel:
                documents[uri]["alt_labels"].append(str(row.altLabel))

        return list(documents.values())

    def get_all_questions(self) -> List[Dict]:
        """
        Get ALL questions from the ontology (not just those in the dialog flow).
        Returns list of questions with their basic properties and section assignments.
        """
        query = prepareQuery("""
            SELECT ?question ?questionId ?questionText ?slotName ?required ?order
            WHERE {
                ?question a mm:MultimodalQuestion .
                ?question dialog:questionId ?questionId .
                ?question dialog:questionText ?questionText .
                ?question dialog:slotName ?slotName .
                ?question dialog:required ?required .
                OPTIONAL { ?question dialog:order ?order . }
            }
            ORDER BY ?order
        """, initNs={"mm": MM, "dialog": DIALOG})

        results = self.graph.query(query)

        questions = []
        for row in results:
            question_id = str(row.questionId)

            # Get section info
            section_info = self.get_section_for_question(question_id)

            # Get multimodal features
            features = self.get_multimodal_features(question_id)

            # Get confidence threshold
            threshold, priority = self.get_confidence_threshold(question_id)

            question_obj = {
                "question_id": question_id,
                "question_text": str(row.questionText),
                "slot_name": str(row.slotName),
                "required": bool(row.required),
                "order": int(row.order) if hasattr(row, 'order') and row.order else 0,
                "tts": features["tts"],
                "visual_components": features["visual_components"],
                "select_options": features["select_options"],
                "faqs": features["faqs"],
                "confidence_threshold": threshold,
                "priority": priority,
                "section": section_info
            }

            questions.append(question_obj)

        return questions

    def get_document_details(self, document_uri: str) -> Dict:
        """
        Get detailed information about a specific document type.
        """
        query = prepareQuery("""
            SELECT ?label ?prefLabel ?type ?requiresOCR ?comment
            WHERE {
                ?doc rdfs:label ?label .
                FILTER(str(?doc) = ?docUriLiteral)

                OPTIONAL { ?doc skos:prefLabel ?prefLabel . }
                OPTIONAL { ?doc a ?type . FILTER(?type != owl:NamedIndividual) }
                OPTIONAL { ?doc doc:requiresOCR ?requiresOCR . }
                OPTIONAL { ?doc rdfs:comment ?comment . }
            }
        """, initNs={"doc": DOC, "rdfs": RDFS, "skos": SKOS, "owl": OWL})

        results = list(self.graph.query(query, initBindings={"docUriLiteral": Literal(document_uri)}))

        if not results:
            return None

        row = results[0]
        details = {
            "uri": document_uri,
            "label": str(row.label),
            "pref_label": str(row.prefLabel) if hasattr(row, 'prefLabel') and row.prefLabel else str(row.label),
            "types": [str(r.type) for r in results if hasattr(r, 'type') and r.type],
            "requires_ocr": bool(row.requiresOCR) if hasattr(row, 'requiresOCR') and row.requiresOCR else False,
            "comment": str(row.comment) if hasattr(row, 'comment') and row.comment else None,
            "alt_labels": []
        }

        # Get alt labels
        alt_query = prepareQuery("""
            SELECT ?altLabel
            WHERE {
                ?doc skos:altLabel ?altLabel .
                FILTER(str(?doc) = ?docUriLiteral)
            }
        """, initNs={"doc": DOC, "skos": SKOS})

        alt_results = self.graph.query(alt_query, initBindings={"docUriLiteral": Literal(document_uri)})
        for row in alt_results:
            if hasattr(row, 'altLabel') and row.altLabel:
                details["alt_labels"].append(str(row.altLabel))

        return details

    def get_extractable_fields_for_document(self, document_uri: str) -> List[Dict]:
        """
        Get all fields that can be extracted from a specific document.
        """
        query = prepareQuery("""
            SELECT ?questionId ?questionText ?slotName ?confidence
            WHERE {
                ?question dialog:questionId ?questionId ;
                          dialog:questionText ?questionText ;
                          dialog:slotName ?slotName ;
                          dialog:extractableFrom ?doc .

                FILTER(str(?doc) = ?docUriLiteral)

                OPTIONAL {
                    ?extraction doc:canExtractField ?slotName ;
                                doc:extractionConfidence ?confidence .
                }
            }
        """, initNs={"dialog": DIALOG, "doc": DOC})

        results = self.graph.query(query, initBindings={"docUriLiteral": Literal(document_uri)})

        fields = []
        for row in results:
            fields.append({
                "question_id": str(row.questionId),
                "question_text": str(row.questionText),
                "slot_name": str(row.slotName),
                "extraction_confidence": float(row.confidence) if hasattr(row, 'confidence') and row.confidence else None
            })

        return fields

    def get_all_sections(self) -> List[Dict]:
        """
        Query all sections from ontology with their metadata.
        Returns list of sections ordered by sectionOrder.
        """
        query = prepareQuery("""
            SELECT ?section ?sectionId ?sectionTitle ?sectionDescription ?sectionOrder
            WHERE {
                ?section a dialog:Section ;
                         dialog:sectionId ?sectionId ;
                         dialog:sectionTitle ?sectionTitle ;
                         dialog:sectionDescription ?sectionDescription ;
                         dialog:sectionOrder ?sectionOrder .
            }
            ORDER BY ?sectionOrder
        """, initNs={"dialog": DIALOG})

        sections = []
        for row in self.graph.query(query):
            sections.append({
                "section_uri": str(row.section),
                "section_id": str(row.sectionId),
                "section_title": str(row.sectionTitle),
                "section_description": str(row.sectionDescription),
                "section_order": int(row.sectionOrder)
            })

        return sections

    def get_section_for_question(self, question_id: str) -> Optional[Dict]:
        """
        Get the section a question belongs to via :inSection relationship.

        Args:
            question_id: Question ID (e.g., "q_first_name")

        Returns:
            Section metadata dict or None if no section assigned
        """
        # Query by questionId property to find the Question resource, then get its section
        query = prepareQuery("""
            SELECT ?section ?sectionId ?sectionTitle ?sectionOrder
            WHERE {
                ?question dialog:questionId ?qid ;
                         dialog:inSection ?section .
                ?section dialog:sectionId ?sectionId ;
                         dialog:sectionTitle ?sectionTitle ;
                         dialog:sectionOrder ?sectionOrder .
            }
        """, initNs={"dialog": DIALOG})

        results = list(self.graph.query(query, initBindings={'qid': Literal(question_id)}))

        if results:
            row = results[0]
            return {
                "section_uri": str(row.section),
                "section_id": str(row.sectionId),
                "section_title": str(row.sectionTitle),
                "section_order": int(row.sectionOrder)
            }

        return None

    def get_questions_by_section(self) -> Dict[str, List]:
        """
        Get all questions grouped by their sections.
        Returns dict with section_id as keys and lists of question_ids as values.
        """
        query = prepareQuery("""
            SELECT ?question ?questionId ?section ?sectionId ?sectionOrder
            WHERE {
                ?question a dialog:Question ;
                         dialog:questionId ?questionId ;
                         dialog:inSection ?section .
                ?section dialog:sectionId ?sectionId ;
                         dialog:sectionOrder ?sectionOrder .
            }
            ORDER BY ?sectionOrder
        """, initNs={"dialog": DIALOG})

        sections_map = {}
        for row in self.graph.query(query):
            section_id = str(row.sectionId)
            question_id = str(row.questionId)

            if section_id not in sections_map:
                sections_map[section_id] = []

            sections_map[section_id].append(question_id)

        return sections_map

    def update_question_section(self, question_id: str, section_id: str) -> bool:
        """
        Update a question's section assignment by modifying the :inSection relationship.

        Args:
            question_id: Question ID (e.g., "q_first_name")
            section_id: Target section ID (e.g., "section_personal_info")

        Returns:
            True if successful, False otherwise
        """
        try:
            # Find the question URI
            question_query = prepareQuery("""
                SELECT ?question ?oldSection
                WHERE {
                    ?question dialog:questionId ?qid .
                    OPTIONAL { ?question dialog:inSection ?oldSection . }
                }
            """, initNs={"dialog": DIALOG})

            results = list(self.graph.query(question_query, initBindings={'qid': Literal(question_id)}))

            if not results:
                logger.error(f"Question not found: {question_id}")
                return False

            question_uri = results[0].question
            old_section = results[0].oldSection if results[0].oldSection else None

            # Find the target section URI
            section_query = prepareQuery("""
                SELECT ?section
                WHERE {
                    ?section a dialog:Section ;
                            dialog:sectionId ?sid .
                }
            """, initNs={"dialog": DIALOG})

            section_results = list(self.graph.query(section_query, initBindings={'sid': Literal(section_id)}))

            if not section_results:
                logger.error(f"Section not found: {section_id}")
                return False

            new_section_uri = section_results[0].section

            # Remove old section relationship if exists
            if old_section:
                self.graph.remove((question_uri, DIALOG.inSection, old_section))

            # Add new section relationship
            self.graph.add((question_uri, DIALOG.inSection, new_section_uri))

            logger.info(f"Updated question {question_id} to section {section_id}")
            return True

        except Exception as e:
            logger.error(f"Error updating question section: {e}")
            return False

    def update_question_order(self, question_id: str, new_order: int) -> bool:
        """
        Update a question's order within its section.

        Args:
            question_id: Question ID
            new_order: New order number

        Returns:
            True if successful, False otherwise
        """
        try:
            # Find the question URI
            question_query = prepareQuery("""
                SELECT ?question
                WHERE {
                    ?question dialog:questionId ?qid .
                }
            """, initNs={"dialog": DIALOG})

            results = list(self.graph.query(question_query, initBindings={'qid': Literal(question_id)}))

            if not results:
                logger.error(f"Question not found: {question_id}")
                return False

            question_uri = results[0].question

            # Remove old order if exists
            self.graph.remove((question_uri, DIALOG.order, None))

            # Add new order
            self.graph.add((question_uri, DIALOG.order, Literal(new_order)))

            logger.info(f"Updated question {question_id} order to {new_order}")
            return True

        except Exception as e:
            logger.error(f"Error updating question order: {e}")
            return False

    def create_section(
        self,
        section_id: str,
        section_title: str,
        section_description: str,
        section_order: int,
        semantic_aliases: List[str] = None,
        skos_labels: List[str] = None
    ) -> bool:
        """
        Create a new section with OWL/SKOS metadata.

        Args:
            section_id: Unique section ID
            section_title: Display title
            section_description: Description text
            section_order: Display order
            semantic_aliases: List of alternative names (SKOS:altLabel)
            skos_labels: List of preferred labels (SKOS:prefLabel)

        Returns:
            True if successful, False otherwise
        """
        try:
            # Create section URI from camelCase version of section_id
            section_name = ''.join(word.capitalize() for word in section_id.replace('section_', '').split('_')) + 'Section'
            section_uri = DIALOG[section_name]

            # Check if section already exists
            existing = list(self.graph.query(
                prepareQuery("SELECT ?s WHERE { ?s dialog:sectionId ?sid }", initNs={"dialog": DIALOG}),
                initBindings={'sid': Literal(section_id)}
            ))

            if existing:
                logger.error(f"Section already exists: {section_id}")
                return False

            # Add section as OWL Class and instance
            self.graph.add((section_uri, rdflib.RDF.type, DIALOG.Section))
            self.graph.add((section_uri, DIALOG.sectionId, Literal(section_id)))
            self.graph.add((section_uri, DIALOG.sectionTitle, Literal(section_title)))
            self.graph.add((section_uri, DIALOG.sectionDescription, Literal(section_description)))
            self.graph.add((section_uri, DIALOG.sectionOrder, Literal(section_order)))
            self.graph.add((section_uri, RDFS.label, Literal(f"{section_title} Section")))

            # Add SKOS metadata if provided
            if semantic_aliases:
                for alias in semantic_aliases:
                    self.graph.add((section_uri, SKOS.altLabel, Literal(alias)))

            if skos_labels:
                for label in skos_labels:
                    self.graph.add((section_uri, SKOS.prefLabel, Literal(label)))

            logger.info(f"Created section: {section_id}")
            return True

        except Exception as e:
            logger.error(f"Error creating section: {e}")
            return False

    def update_section(self, section_id: str, updates: Dict) -> bool:
        """
        Update an existing section's properties.

        Args:
            section_id: Section ID to update
            updates: Dictionary of properties to update

        Returns:
            True if successful, False otherwise
        """
        try:
            # Find the section URI
            section_query = prepareQuery("""
                SELECT ?section
                WHERE {
                    ?section a dialog:Section ;
                            dialog:sectionId ?sid .
                }
            """, initNs={"dialog": DIALOG})

            results = list(self.graph.query(section_query, initBindings={'sid': Literal(section_id)}))

            if not results:
                logger.error(f"Section not found: {section_id}")
                return False

            section_uri = results[0].section

            # Update properties
            if 'section_title' in updates:
                self.graph.remove((section_uri, DIALOG.sectionTitle, None))
                self.graph.add((section_uri, DIALOG.sectionTitle, Literal(updates['section_title'])))
                self.graph.remove((section_uri, RDFS.label, None))
                self.graph.add((section_uri, RDFS.label, Literal(f"{updates['section_title']} Section")))

            if 'section_description' in updates:
                self.graph.remove((section_uri, DIALOG.sectionDescription, None))
                self.graph.add((section_uri, DIALOG.sectionDescription, Literal(updates['section_description'])))

            if 'section_order' in updates:
                self.graph.remove((section_uri, DIALOG.sectionOrder, None))
                self.graph.add((section_uri, DIALOG.sectionOrder, Literal(updates['section_order'])))

            if 'semantic_aliases' in updates:
                # Remove old aliases
                self.graph.remove((section_uri, SKOS.altLabel, None))
                # Add new aliases
                for alias in updates['semantic_aliases']:
                    self.graph.add((section_uri, SKOS.altLabel, Literal(alias)))

            if 'skos_labels' in updates:
                # Remove old labels
                self.graph.remove((section_uri, SKOS.prefLabel, None))
                # Add new labels
                for label in updates['skos_labels']:
                    self.graph.add((section_uri, SKOS.prefLabel, Literal(label)))

            logger.info(f"Updated section: {section_id}")
            return True

        except Exception as e:
            logger.error(f"Error updating section: {e}")
            return False

    def delete_section(self, section_id: str) -> bool:
        """
        Delete a section and unassign all questions from it.

        Args:
            section_id: Section ID to delete

        Returns:
            True if successful, False otherwise
        """
        try:
            # Find the section URI
            section_query = prepareQuery("""
                SELECT ?section
                WHERE {
                    ?section a dialog:Section ;
                            dialog:sectionId ?sid .
                }
            """, initNs={"dialog": DIALOG})

            results = list(self.graph.query(section_query, initBindings={'sid': Literal(section_id)}))

            if not results:
                logger.error(f"Section not found: {section_id}")
                return False

            section_uri = results[0].section

            # Unassign all questions from this section
            questions_query = prepareQuery("""
                SELECT ?question
                WHERE {
                    ?question dialog:inSection ?section .
                }
            """, initNs={"dialog": DIALOG})

            questions = list(self.graph.query(questions_query, initBindings={'section': section_uri}))

            for row in questions:
                self.graph.remove((row.question, DIALOG.inSection, section_uri))

            # Remove all triples with section as subject
            self.graph.remove((section_uri, None, None))

            logger.info(f"Deleted section: {section_id} and unassigned {len(questions)} questions")
            return True

        except Exception as e:
            logger.error(f"Error deleting section: {e}")
            return False

    def save_graph_to_file(self, file_path: str):
        """
        Save the RDF graph to a TTL file.

        Args:
            file_path: Path to save the TTL file
        """
        try:
            self.graph.serialize(destination=file_path, format='turtle')
            logger.info(f"Saved graph to: {file_path}")
        except Exception as e:
            logger.error(f"Error saving graph: {e}")
            raise


if __name__ == "__main__":
    # Example usage
    ontology_paths = [
        "../ontologies/dialog.ttl",
        "../ontologies/dialog-multimodal.ttl",
        "../ontologies/dialog-vocabularies.ttl",
        "../ontologies/dialog-validation.ttl",
        "../ontologies/dialog-confidence.ttl"
    ]
    
    manager = DialogManager(ontology_paths)
    
    # Get TTL configuration
    ttl_config = manager.get_ttl_configuration()
    print(f"Session TTL: {ttl_config['session']}")
    print(f"Answer TTL: {ttl_config['answer']}")
    print(f"Recording TTL: {ttl_config['recording']}")
    
    # Get dialog flow
    flow = manager.get_dialog_flow("InsuranceQuoteDialog")
    print(f"\nDialog flow has {len(flow)} nodes")
    
    # Get multimodal features
    features = manager.get_multimodal_features("q_vehicle_reg_mm")
    print(f"\nMultimodal features: {features}")
    
    # Get confidence threshold
    threshold, priority = manager.get_confidence_threshold("q_vehicle_reg_mm")
    print(f"\nConfidence threshold: {threshold}, Priority: {priority}")
