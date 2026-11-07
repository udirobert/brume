# Brume: The Architecture of an Exhale (59s Commercial)
**Date:** 2026-11-07  
**POC:** Brume Creative Direction & Audio-Visual Production  
**Target:** Chroma Awards (Advertising Division) & AssemblyAI Hackathon #2 (2026)  
**Deliverable:** 59-second 16:9 / 9:16 high-impact film  

---

## TL;DR
A 59-second award-grade commercial engineered around dynamic sonic and psychological contrast. Instead of a continuous background music bed or a standard SaaS software tour, the piece uses **zero music for the first 28 seconds**—building suffocating sensory tension with high-frequency digital noise, frantic haptics, and strained breathing generated via ElevenLabs foley. At second 16, a hard acoustic mute introduces total silence, followed by an intimate binaural inhale and AssemblyAI's brand-new Text-to-Speech API speaking from Brume's side of the room (*"Set it down here. Nothing in this room needs solving"*). At second 28, on the release of the breath, the user's original UK garage track **"Time to Breathe"** detonates with full bass and groove, driving a kinetic showcase of Brume's companion and "propose-never-commit" AssemblyAI Realtime voice check-in, resolving into a bold anti-surveillance tech manifesto.

---

## 1. Creative Architecture

### The Narrative Arc (59 Seconds)
1. **Act I: The Asphyxiation (0:00 – 0:16)**
   * *Acoustic:* Zero music. 6kHz tinnitus sine, claustrophobic shallow breathing, rapid synthetic notification chatter (*"Screen time up 42%... Meeting in 2 minutes"*).
   * *Visual:* Macro, cold, desaturated shots of notification barrage, clutched phone, dilated pupils, frantic scrolling.
   * *Typography:* *Every device wants your attention. Every app wants your body.*
2. **Act II: The Sanctuary & The Turning Point (0:16 – 0:28)**
   * *Acoustic:* Hard mute. Absolute silence. Soft wooden contact. Hyper-close binaural diaphragmatic inhale (ElevenLabs).
   * *Visual:* Phone placed down. Room transitions from cold blue to dawn blush pink. Brume companion awakens into a 7-second cosine breath wave.
   * *Voice (AssemblyAI TTS):* *"Set it down here. Nothing in this room needs solving."*
   * *Acoustic (0:26 – 0:28):* Deep, chest-rattling exhale.
3. **Act III: The Release (0:28 – 0:48)**
   * *Acoustic:* **THE BEAT DROPS AT 0:28.** "Time to Breathe" explodes with Rhodes chords, 122 BPM UK garage shuffle drums, sub-bass, and melodic vocals (*"I feel appreciated that you're listening to me..."*).
   * *Visual:* Kinetic, danceable match cuts. Mascot celebration hop, mist brush dispersing particles, AssemblyAI Realtime voice check-in (*"Drained"* caught in 150ms, glowing chip, ephemeral transcript dissolution).
4. **Act IV: The Manifesto (0:48 – 0:59)**
   * *Acoustic:* Drums filter out; warm Rhodes keys ring out. Soft whisper: *"It's time to breathe."*
   * *Visual:* Room dims to twilight. Mascot settles into peaceful rest.
   * *Typography:*  
     *WE DO NOT SENSE YOU.*  
     *NO CAMERAS. NO STREAKS. NO SCORES.*  
     *JUST SPACE.*  
     *Brume × AssemblyAI*

---

## 2. Technical Stack & Stem Architecture

* **Music:** `"02 time (to breathe).mp3"` by user (122 BPM UK Garage / House, Master track).
* **Foley & Sound Design:**
  * `tension_asphyxiation.mp3` (ElevenLabs Sound Generation: digital hum, haptics, shallow breath).
  * `binaural_inhale_exhale.mp3` (ElevenLabs Sound Generation: hyper-realistic chest breath).
  * `phone_wood_contact.mp3` (Tactile foley).
* **Voice Synthesis:**
  * `assembly_tts_companion.wav` (AssemblyAI Text-to-Speech API `/v1/speech` in 24kHz WAV).
  * `eleven_whisper_outro.mp3` (Soft outro whisper).
* **Visual Engine:**
  * Remotion compositions (`scenes/*.tsx`) rendered via AdaL Video Producer.
  * Real screen capture of Brume WebGL atmosphere, companion animations, and mist brush.
  * Brand tokens: `--brume-dawn`, `--brume-mascot-*`, Manrope typography.
