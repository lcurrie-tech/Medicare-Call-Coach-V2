"""Regenerate the TV voice clips with piper-tts==1.3.0 and ffmpeg.

Usage: python generate_audio.py /path/to/en_US-ljspeech-high.onnx
Piper model: rhasspy/piper-voices, en_US-ljspeech-high.
The model card identifies its LJ Speech source dataset as public domain.
Only final MP3 clips are shipped; no voice engine or model is bundled.
"""
import pathlib
import subprocess
import sys
import tempfile
import wave
from piper import PiperVoice, SynthesisConfig

voice = PiperVoice.load(sys.argv[1])
output = pathlib.Path(__file__).parent / "audio"
output.mkdir(exist_ok=True)
names = {
    "fernando": "Fernando Carrillo",
    "jairy": "Jairy Aguilar",
    "maria": "Maria Palomo",
    "samantha": "Samantha Diaz",
    "selena": "Selena Moncado",
    "maritza": "Maritza Aparicio",
}
clips = {key: f"Shout out to {name}! Another application on the board. Let's go, Palmetto!" for key, name in names.items()}
clips["sound-enabled"] = "Palmetto shout outs are on. Let's celebrate the next application!"
with tempfile.TemporaryDirectory() as tmp:
    for name, text in clips.items():
        wav_path = pathlib.Path(tmp) / f"{name}.wav"
        with wave.open(str(wav_path), "wb") as wav_file:
            voice.synthesize_wav(text, wav_file, syn_config=SynthesisConfig(length_scale=0.88))
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path),
            "-af", "loudnorm=I=-17:TP=-2:LRA=7", "-codec:a", "libmp3lame",
            "-b:a", "48k", "-ar", "24000", str(output / f"{name}.mp3"),
        ], check=True)
        print(name, (output / f"{name}.mp3").stat().st_size, flush=True)
