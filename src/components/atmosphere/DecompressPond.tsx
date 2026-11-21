import { memo } from "react";

export type PondBeat = "idle" | "splash" | "enter" | "land";
export type PondMoment = { kind: PondBeat; id: number };
export type PondMood = "bank" | "near" | "rest";

/**
 * DecompressPond — "Brume and the frog": a small paper-cut lily pool
 * the companion stands in. Pure presentation: one inline SVG, no
 * assets, no clocks, no RAF.
 *
 * `mood` (derived from the room stage) slides the frog's pad in from
 * the bank on a durable transform — it never replays on its own.
 * `moment` is a one-shot beat: a transient group keyed by `moment.id`
 * carries the rings/droplets, so each beat runs exactly once and a
 * faster next beat simply replaces it — no queued callbacks.
 * The frog's expression is a persistent layer (not keyed), so its
 * eyes can crossfade gently on `land` even while the pad rocks.
 */
export const DecompressPond = memo(function DecompressPond({
  moment,
  mood,
}: {
  moment: PondMoment;
  mood: PondMood;
}) {
  const lively = moment.kind === "enter" || moment.kind === "splash";
  return (
    <svg
      viewBox="0 0 480 190"
      aria-hidden="true"
      focusable="false"
      className="dc-pond__svg"
      preserveAspectRatio="xMidYMid meet"
      data-beat={moment.kind}
      data-moment={moment.id}
      data-mood={mood}
    >
      {/* muddy bank, exposed on the left under the water */}
      <path
        className="dc-pond__mud"
        d="M52 112 C44 92 66 66 118 60 C150 56 168 62 178 70 C160 84 148 100 138 116 C112 148 66 138 52 112 Z"
      />
      {/* back lobe — duck-egg wash */}
      <path
        className="dc-pond__wash dc-pond__wash--back"
        d="M74 118 C58 96 84 70 150 66 C206 62 232 74 300 66 C372 58 424 74 420 106 C418 128 372 146 300 150 C236 154 224 160 168 156 C108 152 88 138 74 118 Z"
      />
      {/* front lobe — slightly deeper sage, overlapping */}
      <path
        className="dc-pond__wash dc-pond__wash--front"
        d="M98 118 C88 102 108 84 164 82 C216 80 244 90 306 82 C362 75 398 88 396 110 C394 128 354 142 296 144 C240 146 226 152 178 149 C128 146 108 134 98 118 Z"
      />

      {/* companion's contact shadow + broken reflection */}
      <ellipse className="dc-pond__shadow" cx="240" cy="150" rx="44" ry="7" />
      <g className="dc-pond__reflection">
        <path d="M214 144 C228 143 240 144 252 143" />
        <path d="M224 151 C232 150 244 151 256 150" />
        <path d="M218 157 C226 156 234 157 242 156" />
      </g>

      {/* broken ivory ink lines near the shoreline */}
      <g className="dc-pond__edge">
        <path d="M92 108 C104 98 120 90 138 86" />
        <path d="M168 78 C190 74 212 76 234 76" />
        <path d="M288 76 C316 72 344 74 366 80" />
        <path d="M384 96 C390 102 392 110 388 116" />
        <path d="M120 138 C136 146 158 150 182 150" />
        <path d="M262 152 C292 150 322 146 346 140" />
      </g>

      {/* left bank: pebbles, a mussel, bent sedge */}
      <g className="dc-pond__bank">
        <path className="dc-pond__sedge" d="M96 100 C90 80 84 64 74 50" />
        <path className="dc-pond__sedge" d="M112 94 C112 72 116 56 110 42" />
        <path className="dc-pond__sedge-leaf" d="M90 78 C80 74 72 76 66 70 C74 66 84 66 91 70 Z" />
        <path className="dc-pond__sedge-leaf" d="M110 62 C102 56 100 48 92 44 C102 42 110 50 112 56 Z" />
        <ellipse className="dc-pond__pebble" cx="128" cy="112" rx="12" ry="7.5" />
        <ellipse className="dc-pond__pebble dc-pond__pebble--light" cx="144" cy="109" rx="6" ry="4" />
        <path className="dc-pond__mussel" d="M112 108 C112 103 118 100 123 102 C128 104 129 109 125 112 C121 115 114 113 112 108 Z" />
      </g>

      {/* right bank: asymmetric cattails, buff seedheads */}
      <g className="dc-pond__bank">
        <path className="dc-pond__sedge" d="M404 104 C408 78 404 54 412 32" />
        <path className="dc-pond__sedge" d="M424 106 C420 84 428 66 424 50" />
        <ellipse className="dc-pond__cattail" cx="412" cy="26" rx="5" ry="13" />
        <ellipse className="dc-pond__cattail" cx="424" cy="44" rx="4.5" ry="10" />
        <path className="dc-pond__sedge-leaf" d="M410 84 C418 78 422 70 430 66 C422 64 412 70 408 78 Z" />
      </g>

      {/* anchor rings where the companion stands */}
      <g className="dc-pond__anchor">
        <ellipse cx="240" cy="146" rx="28" ry="5.5" />
      </g>

      {/* lily clump near the frog: two notched pads + a blush bloom */}
      <g className="dc-pond__pads">
        <path
          className="dc-pond__pad"
          d="M288 138 C288 130 300 125 312 127 C324 129 329 137 322 143 C315 149 301 149 294 145 C289 142 288 140 288 138 Z"
        />
        <path className="dc-pond__pad-notch" d="M312 127 L322 136" />
        <path className="dc-pond__pad-vein" d="M310 131 C304 132 299 135 295 138" />
        <path className="dc-pond__pad-vein" d="M310 136 C306 138 302 140 298 141" />
        <path
          className="dc-pond__pad dc-pond__pad--small"
          d="M262 152 C262 147 270 143 278 144 C286 145 290 150 285 154 C280 158 270 158 266 156 C263 154 262 153 262 152 Z"
        />
        <path className="dc-pond__pad-notch" d="M278 144 L285 151" />
        <g className="dc-pond__bloom">
          <path d="M312 122 C309 116 310 108 314 105 C318 108 319 116 316 122 Z" />
          <path d="M310 122 C305 118 303 111 305 107 C310 109 312 115 313 121 Z" />
          <path d="M315 122 C318 117 321 111 319 106 C314 108 313 115 313 121 Z" />
        </g>
      </g>

      {/* the frog — permanent mover slides him in per mood; the inner
          keyed group rocks the pad per beat; eyelids stay persistent so
          they can crossfade into sleep on land */}
      <g className="dc-frog" data-mood={mood}>
        <g className="dc-frog__tilt">
          <g key={`pad-${moment.id}`} className={`dc-frog__rock dc-frog__rock--${moment.kind}`}>
            <path
              className="dc-pond__pad dc-pond__pad--frog"
              d="M348 124 C346 114 360 106 376 108 C392 110 399 120 392 128 C384 136 366 137 356 132 C350 129 348 126 348 124 Z"
            />
            <path className="dc-pond__pad-notch" d="M376 108 L386 119" />
            <path className="dc-pond__pad-vein" d="M374 114 C366 116 360 119 355 122" />
            <path className="dc-pond__pad-vein" d="M375 119 C368 122 362 125 357 127" />
            {/* frog body, facing inward (toward Brume at x=240) */}
            <g className="dc-frog__body">
              {/* short curved hind feet under the pad line */}
              <path className="dc-frog__foot" d="M355 113 C351 115 348 118 347 122" />
              <path className="dc-frog__foot" d="M383 112 C387 114 390 117 391 121" />
              {/* one round head, continuous with both bumped eyes */}
              <path
                className="dc-frog__torso"
                d="M357 90 C357 84 362 81 368 81 C374 81 379 84 380 89 C386 92 388 99 386 106 C384 114 375 119 367 118 C359 117 354 111 354 103 C354 98 355 93 357 90 Z"
              />
              {/* cream chin/cheek patch toward Brume */}
              <ellipse className="dc-frog__chin" cx="362" cy="106" rx="5.5" ry="3.4" />
              {/* tiny upward mouth, skewed toward the water's center */}
              <path className="dc-frog__mouth" d="M360 102 C362 103.5 365 103.5 367 101.5" />
              {/* eyes bumped on top — pupils turned toward center */}
              <circle className="dc-frog__eye-bump" cx="363" cy="85" r="4.5" />
              <circle className="dc-frog__eye-bump" cx="375" cy="85" r="4.5" />
              <circle className="dc-frog__pupil" cx="362" cy="85" r="1.9" />
              <circle className="dc-frog__pupil" cx="374" cy="85" r="1.9" />
              <circle className="dc-frog__glint" cx="361.2" cy="84" r=".7" />
              <circle className="dc-frog__glint" cx="373.2" cy="84" r=".7" />
              {/* one quick blink on lively beats */}
              {lively && (
                <g className="dc-frog__blink">
                  <ellipse cx="363" cy="85" rx="4.5" ry="4.2" />
                  <ellipse cx="375" cy="85" rx="4.5" ry="4.2" />
                </g>
              )}
            </g>
          </g>
          {/* sleepy lids — persistent, opacity-driven by mood */}
          <g className="dc-frog__lids">
            <path className="dc-frog__lid" d="M358.5 85 C361 87.5 365 87.5 367.5 85" />
            <path className="dc-frog__lid" d="M370.5 85 C373 87.5 377 87.5 379.5 85" />
          </g>
        </g>
      </g>

      {/* transient beat layer — keyed by moment.id, finite keyframes */}
      {moment.id > 0 && (
        <g key={moment.id} className={`dc-pond__fx dc-pond__fx--${moment.kind}`}>
          {lively ? (
            <>
              <ellipse className="dc-pond__ripple" cx="240" cy="146" rx="26" ry="6" />
              <ellipse className="dc-pond__ripple dc-pond__ripple--late" cx="240" cy="146" rx="26" ry="6" />
              <path className="dc-pond__drop dc-pond__drop--a" d="M226 140 C225 136 227 132 230 130 C233 132 235 136 234 140 C231 143 228 143 226 140 Z" />
              <path className="dc-pond__drop dc-pond__drop--b" d="M246 138 C245 134 247 130 250 128 C253 130 255 134 254 138 C251 141 248 141 246 138 Z" />
              <path className="dc-pond__drop dc-pond__drop--c" d="M236 144 C235 141 236 138 238 136 C240 138 241 141 240 144 C239 146 237 146 236 144 Z" />
            </>
          ) : (
            moment.kind === "land" && (
              <ellipse className="dc-pond__ripple dc-pond__ripple--land" cx="240" cy="146" rx="24" ry="5.5" />
            )
          )}
        </g>
      )}
    </svg>
  );
});

export default DecompressPond;
