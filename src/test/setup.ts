import "@testing-library/jest-dom/vitest"
// Initializes the real i18next instance (src/i18n/index.ts) for every
// test — without this, react-i18next has no resources loaded and
// useTranslation()'s t() just echoes the raw key back (e.g. "login.email"
// instead of "Email"), which breaks any test that queries rendered text
// or accessible labels rather than mocking translation away entirely.
import "../i18n"
