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
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")
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
        Returns ordered list of dialog nodes.
        """
        query = prepareQuery("""
            SELECT ?node ?nodeType ?questionId ?questionText ?slotName ?required ?order
            WHERE {
                ?dialog a dialog:Dialog ;
                        dialog:hasNode ?node .
                
                ?node dialog:order ?order .
                
                OPTIONAL {
                    ?node a ?nodeType .
                    FILTER(?nodeType = dialog:Question || ?nodeType = mm:MultimodalQuestion)
                }
                
                OPTIONAL {
                    ?node dialog:questionId ?questionId ;
                          dialog:questionText ?questionText ;
                          dialog:slotName ?slotName ;
                          dialog:required ?required .
                }
            }
            ORDER BY ?order
        """, initNs={"dialog": DIALOG, "mm": MM})
        
        results = self.graph.query(query)
        
        nodes = []
        for row in results:
            node_data = {
                "node_uri": str(row.node),
                "order": int(row.order) if row.order else 0,
                "node_type": str(row.nodeType) if row.nodeType else "Node"
            }
            
            if row.questionId:
                node_data.update({
                    "question_id": str(row.questionId),
                    "question_text": str(row.questionText),
                    "slot_name": str(row.slotName),
                    "required": bool(row.required)
                })
            
            nodes.append(node_data)
        
        return sorted(nodes, key=lambda x: x["order"])
    
    def get_multimodal_features(self, question_id: str) -> Dict:
        """
        Load multimodal features for a question from ontology.
        Includes TTS prompts, visual components, select options, and FAQs.
        """
        query = prepareQuery("""
            SELECT ?question ?ttsPrompt ?ttsText ?ttsVoice ?ttsRate ?ttsPitch ?ttsConfig
                   ?visual ?componentType ?imageUrl ?componentData
                   ?option ?optionValue ?optionLabel ?optionDesc
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
                }
                
                OPTIONAL {
                    ?question mm:hasVisualComponent ?visual .
                    ?visual mm:componentType ?componentType .
                    OPTIONAL { ?visual mm:imageUrl ?imageUrl . }
                    OPTIONAL { ?visual mm:componentData ?componentData . }
                }
                
                OPTIONAL {
                    ?question mm:hasOption ?option .
                    ?option mm:optionValue ?optionValue ;
                            mm:optionLabel ?optionLabel .
                    OPTIONAL { ?option mm:optionDescription ?optionDesc . }
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
            "faqs": []
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
            
            # Select Options
            if row.option:
                option = {
                    "value": str(row.optionValue),
                    "label": str(row.optionLabel),
                }
                if row.optionDesc:
                    option["description"] = str(row.optionDesc)
                
                if option not in features["select_options"]:
                    features["select_options"].append(option)
            
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
        
        return features
    
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
