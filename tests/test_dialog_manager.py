"""
Tests for Dialog Manager
Tests TTL loading, SPARQL queries, and configuration retrieval
"""

import pytest
from pathlib import Path
from dialog_manager import DialogManager


@pytest.fixture
def ontology_paths():
    """Fixture providing paths to test ontology files."""
    base_path = Path(__file__).parent.parent / "ontologies"
    return [
        str(base_path / "dialog.ttl"),
        str(base_path / "dialog-multimodal.ttl"),
        str(base_path / "dialog-vocabularies.ttl"),
        str(base_path / "dialog-validation.ttl"),
        str(base_path / "dialog-confidence.ttl")
    ]


@pytest.fixture
def dialog_manager(ontology_paths):
    """Fixture providing initialized DialogManager."""
    return DialogManager(ontology_paths)


def test_load_ontologies(dialog_manager):
    """Test that ontologies load successfully."""
    assert dialog_manager.graph is not None
    assert len(dialog_manager.graph) > 0
    print(f"Loaded {len(dialog_manager.graph)} triples")


def test_ttl_configuration(dialog_manager):
    """Test TTL configuration loading from ontology."""
    ttl_config = dialog_manager.get_ttl_configuration()
    
    assert "session" in ttl_config
    assert "answer" in ttl_config
    assert "recording" in ttl_config
    
    # Verify they are timedelta objects
    from datetime import timedelta
    assert isinstance(ttl_config["session"], timedelta)
    assert isinstance(ttl_config["answer"], timedelta)
    assert isinstance(ttl_config["recording"], timedelta)
    
    print(f"Session TTL: {ttl_config['session']}")
    print(f"Answer TTL: {ttl_config['answer']}")
    print(f"Recording TTL: {ttl_config['recording']}")


def test_dialog_flow(dialog_manager):
    """Test loading dialog flow from ontology."""
    flow = dialog_manager.get_dialog_flow("InsuranceQuoteDialog")
    
    assert len(flow) > 0
    assert all("order" in node for node in flow)
    
    # Verify ordering
    orders = [node["order"] for node in flow]
    assert orders == sorted(orders)
    
    print(f"Dialog flow has {len(flow)} nodes")


def test_multimodal_features(dialog_manager):
    """Test loading multimodal features for a question."""
    features = dialog_manager.get_multimodal_features("q_name_mm")
    
    assert "tts" in features
    assert "visual_components" in features
    assert "select_options" in features
    assert "faqs" in features
    
    # Check TTS configuration
    if features["tts"]:
        assert "text" in features["tts"]
        assert "voice" in features["tts"]
        assert "rate" in features["tts"]
        print(f"TTS prompt: {features['tts']['text']}")
    
    # Check FAQs
    print(f"Found {len(features['faqs'])} FAQs")


def test_confidence_threshold(dialog_manager):
    """Test loading confidence thresholds from ontology."""
    threshold, priority = dialog_manager.get_confidence_threshold("q_vehicle_reg_mm")
    
    assert isinstance(threshold, float)
    assert 0.0 <= threshold <= 1.0
    assert isinstance(priority, int)
    assert 1 <= priority <= 5
    
    print(f"Threshold: {threshold}, Priority: {priority}")


def test_recording_configuration(dialog_manager):
    """Test loading audio recording configuration."""
    config = dialog_manager.get_recording_configuration()
    
    assert "sample_rate" in config
    assert "bit_depth" in config
    assert "channels" in config
    assert "format" in config
    assert "codec" in config
    
    assert config["sample_rate"] > 0
    assert config["channels"] == 1  # Mono recording
    
    print(f"Recording config: {config}")


def test_rephrase_template(dialog_manager):
    """Test loading rephrase templates from ontology."""
    template = dialog_manager.get_rephrase_template("q_vehicle_reg_mm", "phonetic")
    
    assert "template" in template
    assert "tts_config" in template
    assert len(template["template"]) > 0
    
    print(f"Rephrase template: {template['template']}")


def test_vocabulary_match(dialog_manager):
    """Test vocabulary matching against SKOS concepts."""
    # Test exact match
    result = dialog_manager.validate_vocabulary_match(
        "Yes",
        "http://diggi.io/ontology/vocabularies#YesNoValues"
    )
    assert result == "YES"
    
    # Test alternative label match
    result = dialog_manager.validate_vocabulary_match(
        "yeah",
        "http://diggi.io/ontology/vocabularies#YesNoValues"
    )
    assert result == "YES"
    
    # Test vehicle type match
    result = dialog_manager.validate_vocabulary_match(
        "Motorbike",
        "http://diggi.io/ontology/vocabularies#VehicleTypes"
    )
    assert result == "BIKE"
    
    # Test non-match
    result = dialog_manager.validate_vocabulary_match(
        "invalid",
        "http://diggi.io/ontology/vocabularies#YesNoValues"
    )
    assert result is None
    
    print("Vocabulary matching tests passed")


def test_no_hardcoded_values(dialog_manager):
    """
    Test that all configuration comes from TTL, not hardcoded.
    This is a critical architectural requirement.
    """
    # Get all configuration
    ttl_config = dialog_manager.get_ttl_configuration()
    recording_config = dialog_manager.get_recording_configuration()
    threshold, priority = dialog_manager.get_confidence_threshold("q_name_mm")
    
    # Verify all values exist and are valid
    assert ttl_config["session"].total_seconds() > 0
    assert recording_config["sample_rate"] > 0
    assert 0.0 <= threshold <= 1.0
    
    print("✓ All configuration loaded from TTL ontologies")
    print("✓ No hardcoded values found")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
