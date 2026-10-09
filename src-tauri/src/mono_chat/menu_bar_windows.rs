use serde::Deserialize;
const PORTRAIT_PIXELS: usize = 56;
const SPRITE_SCALE: f64 = 2.0;
pub(super) struct Action {
    pub id: &'static str,
    pub title: &'static str,
}
pub(super) const ACTIONS: [Action; 2] = [
    Action {
        id: "mono-chat-composer",
        title: "Quick Composer",
    },
    Action {
        id: "mono-chat-quit",
        title: "Quit MyCode",
    },
];
pub(super) fn decorate(_: &tauri::tray::TrayIcon) -> tauri::Result<()> {
    Ok(())
}
#[derive(Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MenuMascot {
    mono_id: String,
    rects: Vec<MascotRect>,
}

#[derive(Clone, Deserialize, PartialEq)]
struct MascotRect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    fill: String,
}

pub(super) fn icon_for(
    mono_id: &str,
    mascots: &[MenuMascot],
) -> Option<tauri::image::Image<'static>> {
    mascots
        .iter()
        .find(|mascot| mascot.mono_id == mono_id)
        .map(|mascot| portrait(&mascot.rects))
}

fn portrait(rects: &[MascotRect]) -> tauri::image::Image<'static> {
    // Feed real RGBA pixels to IconMenuItemBuilder so the native menu model
    // owns the image. Render at 2× for a crisp 28pt Retina portrait, using the
    // same shaded layers and crisp rectangle edges as the in-app mascot.
    let mut rgba = vec![0; PORTRAIT_PIXELS * PORTRAIT_PIXELS * 4];
    let center = PORTRAIT_PIXELS as f64 / 2.0;
    // The sprite sits centred in the circle, like the glyphs in macOS's
    // own status menus, rather than filling it.
    let inset = center - 8.0 * SPRITE_SCALE;
    for y in 0..PORTRAIT_PIXELS {
        for x in 0..PORTRAIT_PIXELS {
            let distance =
                ((x as f64 + 0.5 - center).powi(2) + (y as f64 + 0.5 - center).powi(2)).sqrt();
            let alpha = (center - 2.0 - distance + 0.5).clamp(0.0, 1.0) * 0.12;
            blend(
                &mut rgba[(y * PORTRAIT_PIXELS + x) * 4..][..4],
                [0.5, 0.5, 0.5, alpha],
            );
        }
    }
    for rect in rects {
        let Some(fill) = color(&rect.fill) else {
            continue;
        };
        let edge = |value: f64| {
            (inset + value * SPRITE_SCALE)
                .round()
                .clamp(0.0, PORTRAIT_PIXELS as f64) as usize
        };
        for y in edge(rect.y)..edge(rect.y + rect.h) {
            for x in edge(rect.x)..edge(rect.x + rect.w) {
                blend(&mut rgba[(y * PORTRAIT_PIXELS + x) * 4..][..4], fill);
            }
        }
    }
    tauri::image::Image::new_owned(rgba, PORTRAIT_PIXELS as u32, PORTRAIT_PIXELS as u32)
}

fn blend(pixel: &mut [u8], [r, g, b, a]: [f64; 4]) {
    let previous = f64::from(pixel[3]) / 255.0;
    let alpha = a + previous * (1.0 - a);
    if alpha == 0.0 {
        return;
    }
    for (channel, source) in pixel[..3].iter_mut().zip([r, g, b]) {
        *channel = ((source * a + f64::from(*channel) / 255.0 * previous * (1.0 - a)) / alpha
            * 255.0)
            .round() as u8;
    }
    pixel[3] = (alpha * 255.0).round() as u8;
}

/// The three color formats emitted by pixelLayers (not arbitrary user CSS).
fn color(fill: &str) -> Option<[f64; 4]> {
    if let Some(hex) = fill.strip_prefix('#').filter(|hex| hex.len() == 6) {
        let rgb = u32::from_str_radix(hex, 16).ok()?;
        return Some([
            ((rgb >> 16) & 255) as f64 / 255.0,
            ((rgb >> 8) & 255) as f64 / 255.0,
            (rgb & 255) as f64 / 255.0,
            1.0,
        ]);
    }
    let values: Vec<f64> = fill
        .split(['(', ')', ',', ' ', '%'])
        .filter_map(|value| value.parse().ok())
        .collect();
    if fill.starts_with("rgba(") && values.len() == 4 {
        return Some([
            values[0] / 255.0,
            values[1] / 255.0,
            values[2] / 255.0,
            values[3],
        ]);
    }
    if fill.starts_with("hsl(") && values.len() == 3 {
        let [h, s, l] = [values[0] / 30.0, values[1] / 100.0, values[2] / 100.0];
        let amplitude = s * l.min(1.0 - l);
        let channel = |offset: f64| {
            let k = (offset + h).rem_euclid(12.0);
            l - amplitude * (k - 3.0).min(9.0 - k).clamp(-1.0, 1.0)
        };
        return Some([channel(0.0), channel(8.0), channel(4.0), 1.0]);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_portrait_preserves_pixel_mascot_colors_and_alpha() {
        assert_eq!(
            color("#263331"),
            Some([38.0 / 255.0, 51.0 / 255.0, 49.0 / 255.0, 1.0])
        );
        assert_eq!(
            color("rgba(255,255,244,0.75)"),
            Some([1.0, 1.0, 244.0 / 255.0, 0.75])
        );
        for (fill, expected) in [
            ("hsl(0 100% 50%)", [1.0, 0.0, 0.0, 1.0]),
            ("hsl(120 100% 50%)", [0.0, 1.0, 0.0, 1.0]),
            ("hsl(240 100% 50%)", [0.0, 0.0, 1.0, 1.0]),
            ("hsl(90 0% 60%)", [0.6, 0.6, 0.6, 1.0]),
        ] {
            assert_eq!(color(fill), Some(expected), "{fill}");
        }
        assert_eq!(color("unknown"), None);
    }

    #[test]
    fn menu_portrait_contains_the_mascot_pixels_and_transparent_corners() {
        let image = portrait(&[
            MascotRect {
                x: 2.0,
                y: 2.0,
                w: 12.0,
                h: 12.0,
                fill: "hsl(0 100% 50%)".into(),
            },
            MascotRect {
                x: 5.0,
                y: 5.0,
                w: 1.5,
                h: 1.5,
                fill: "#263331".into(),
            },
        ]);
        assert_eq!((image.width(), image.height()), (56, 56));
        let pixel = |x: usize, y: usize| &image.rgba()[(y * 56 + x) * 4..][..4];
        assert_eq!(pixel(0, 0), [0, 0, 0, 0]);
        // The 16-unit sprite spans the middle 32 pixels, inset 12 on each side.
        assert_eq!(pixel(18, 18), [255, 0, 0, 255]);
        assert_eq!(pixel(23, 23), [38, 51, 49, 255]);
        assert_eq!(pixel(23, 36), [255, 0, 0, 255], "sprite stays upright");
        assert_ne!(pixel(14, 28), [255, 0, 0, 255], "sprite leaves a margin");
    }

    #[test]
    fn each_mono_receives_its_own_portrait_when_the_payload_order_changes() {
        let mascots = [
            MenuMascot {
                mono_id: "second".into(),
                rects: vec![MascotRect {
                    x: 2.0,
                    y: 2.0,
                    w: 12.0,
                    h: 12.0,
                    fill: "#0000ff".into(),
                }],
            },
            MenuMascot {
                mono_id: "first".into(),
                rects: vec![MascotRect {
                    x: 2.0,
                    y: 2.0,
                    w: 12.0,
                    h: 12.0,
                    fill: "#ff0000".into(),
                }],
            },
        ];
        let center = (28 * 56 + 28) * 4;
        assert_eq!(
            &icon_for("first", &mascots).unwrap().rgba()[center..][..4],
            [255, 0, 0, 255]
        );
        assert_eq!(
            &icon_for("second", &mascots).unwrap().rgba()[center..][..4],
            [0, 0, 255, 255]
        );
        assert!(icon_for("missing", &mascots).is_none());
    }
}
