# Language packs / 语言包

This fork adds English and Simplified Chinese UI support. Open **Settings → General → Language** (设置 → 常规 → 语言). Choices are automatic, 简体中文, and English. Changes apply immediately, preserve open sessions and drafts, persist on this device, and propagate to other windows.

## Automatic selection

- Named Chinese-region time zones (including Shanghai, Urumqi, Hong Kong, Macau, Taipei and their legacy aliases) select Simplified Chinese.
- Other region time zones select English. UTC offsets are not used: Singapore and Shanghai both use UTC+8 but are different regions.
- If time zone information is unavailable or UTC, the first system/browser language selects Chinese when it starts with `zh`; otherwise English.
- An explicit choice always overrides detection. Automatic mode rechecks on window focus, including after a computer time-zone change.

Time zone is a regional heuristic, not a reliable indication of someone's preferred language. The visible manual override is intentional. Traditional Chinese is not a separate pack in this release.

## Coverage and extension

Translations are in `src/shared/i18n/zh-CN.json`. English source messages are the keys and also the fallback. React components use `useTranslation()` and `t(message)` at render time. Static setting metadata is translated when displayed and included in localized search. Do not translate stored identifiers, commands, file paths, user content, provider output or model names.

The initial pack covers General/Appearance/Chat settings, settings navigation, the Windows menu bar, project/session navigation, the composer and common actions/dialog buttons. Less common advanced views, native OS/tray dialogs, upstream release notes, and messages returned by providers may still use English. Missing keys intentionally retain English. This release does not claim a complete translation of every upstream screen.

To extend a pack, add the English message and translation to the JSON dictionary and call `t()` where that UI text is rendered. Subscribe through `useTranslation()` in each independently rendered component. Include the locale in memo dependencies if a memo stores translated text. To add another language, extend `Locale`, the language selector and time-zone policy, then add detection and UI tests.

## Windows distribution

Version 0.4.0 belongs to the dcxa521gi fork. Download installers from https://github.com/dcxa521gi/monocode/releases. The installer itself also offers English and Simplified Chinese. Installer language selection follows NSIS/Windows conventions; **the app's automatic selection uses the computer time zone**.

Build with `npm ci` and `npm run build:windows`. The NSIS installer is generated under `target/release/bundle/nsis/`. This fork does not configure signed automatic updates; the manual update notice points to this fork's Releases page. Installers are not Authenticode-signed.

## Manual acceptance

1. On first launch with an Asia/Shanghai time zone, confirm settings and main navigation display Chinese.
2. Select English in 设置 → 常规 → 语言. Confirm the page updates immediately and open drafts remain intact.
3. Close and reopen the app; English should remain selected.
4. Select 自动（跟随电脑时区）. Shanghai should use Chinese; America/New_York and Asia/Singapore should use English.
5. Search settings for 语言 or 外观 in Chinese mode. Open another MonoCode window and verify a language change reaches both windows.
6. Confirm that source files, project names, agent messages and executable command strings are unchanged.
