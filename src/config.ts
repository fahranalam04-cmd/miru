// AniList OAuth client id (public, safe to commit). Create one at https://anilist.co/settings/developer
// with the redirect URL set to wherever the site is served, e.g. https://<user>.github.io/miru/
// Leave empty to run in local-only mode (the list lives in this browser).
export const ANILIST_CLIENT_ID: string = import.meta.env.VITE_ANILIST_CLIENT_ID ?? '';
