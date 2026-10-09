# MyCode delivery rules

- Before each MyCode upgrade or optimization, compare the current upstream MonoCode release and commits with the last recorded baseline. Maintain a complete checklist of new features, capabilities, fixes and improvements, and record their actual integration and validation results in the release notes; preserve MyCode branding, model routing and Windows support.
- Every new MonoCode feature and capability must be integrated into MyCode as part of the upgrade. Architectural differences or overlap with existing MyCode features require implementation and adaptation, not silently omitting the feature or declaring it integrated without working behavior. Adapt platform-specific capabilities to the applicable target platform and document their scope accurately.
- When MonoCode functionality conflicts with existing MyCode functionality, use MonoCode's functionality and behavior as the primary basis and fuse the existing MyCode additions into it. Resolve the conflict while preserving existing user work, credentials and conversation history.
- All newly integrated features and capabilities must include Simplified Chinese localization alongside the existing English support. Localize user-facing pages, menus, buttons, dialogs, statuses, tooltips, errors and operation feedback; validate both languages before delivery.
- Compare Cindy and https://github.com/Emanuele-web04/synara for locally runnable development and office capabilities to complement the MonoCode baseline and MyCode additions.
- Use only Cindy's open-source, locally runnable capabilities. Do not integrate Cindy cloud services.
- Deliver the source and Windows installer to dcxa521gi/MyCode-Pro. Always include an absolute local installer file link in the final handoff, as well as the release link.
- Group chats keep independent folders and memory. Automatic idle chat is off by default; users can enable it and set a Token limit.
- Preserve existing user work, installed credentials and conversation history. Do not move or delete existing user data merely to change storage defaults.
