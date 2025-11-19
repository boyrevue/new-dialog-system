# Sound Files

This directory contains audio files used by the multimodal dialog system.

## Required Files

### snore.wav
- **Purpose**: Played every 5 minutes when TTS is on autopause (after 4 rephrase attempts with no user response)
- **Format**: WAV audio file
- **Recommended**: Short snoring sound effect (1-3 seconds)
- **Volume**: Will be played at 50% volume
- **Example sources**:
  - freesound.org
  - soundbible.com
  - zapsplat.com (free sound effects)

## How to Add

1. Download or create a snore sound effect in WAV format
2. Name it `snore.wav`
3. Place it in this directory: `frontend/public/sounds/snore.wav`
4. The system will automatically play it every 5 minutes during TTS autopause

## Note

If the file is missing, the system will log a warning in the console but will continue to function normally without sound effects.
