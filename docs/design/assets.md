# Endorphins photography

Created for Endorphins with OpenAI image generation on 2026-10-03. These are original generated editorial images, not photographs of app users or testimonials. No Nike, Strava, Mobbin, or Recent.design imagery is redistributed.

## Daylight training studio

- Source: `docs/design/assets/training-studio.png`, 1536 × 1024.
- Web: `frontend/public/images/training-studio.jpg`, approximately 276 KB; JPEG quality 84.
- Placement: landing hero and sign-in/sign-up editorial panel. Hero uses an explicit intrinsic size and high fetch priority. Mobile crop favors the athlete at 70% horizontal position.
- Direction/prompt: premium, realistic athletic editorial photography for adults 28-50. A fit Black woman around 38 in unbranded charcoal training clothes, doing a natural standing side stretch in a daylight industrial training studio. Pale concrete, large windows, directional morning light, warm natural skin, a restrained orange bench accent. Full body with believable anatomy, feet visible, generous negative space to the left, subject right of center. No logos, captions, watermark, artificial glow, dramatic gym neon, or impossible pose. Wide landscape image.

## Before training

- Source: `docs/design/assets/before-training.png`, 1536 × 1024.
- Web: `frontend/public/images/before-training.jpg`, approximately 260 KB; JPEG quality 82.
- Placement: How it works editorial image. Lazy loading and async decoding keep it outside the critical rendering path.
- Direction/prompt: close editorial crop of an adult athlete around 35-50 tying neutral training shoes beside a small orange bench in the same bright concrete studio. Hands, shoes, a little training equipment, natural skin texture and directional daylight. Grounded, quiet preparation before movement, premium sports photography without logos, typography, or branded clothing. Wide landscape image.

PNG originals stay outside the web public directory. Only JPEG derivatives are served. The production server serves `/images/` with a one-hour public cache, validates real paths, and rejects traversal outside the client directory.
