/*
 * Phase 1 icon bridge.
 *
 * UiIcon is the existing consistent outline SVG system used by operational
 * profiles. Re-export it from the UI Kit namespace so new components have one
 * canonical import path while legacy imports keep working during migration.
 */
export { default } from "@/components/UiIcon";
export type { UiIconName } from "@/components/UiIcon";
