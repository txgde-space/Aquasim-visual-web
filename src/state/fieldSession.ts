import { shallowRef } from 'vue'

// Only the field page owns local map handles. Never serialize File or share with replay.
export const fieldMapSource = shallowRef<{ file: File; origin: { lon: number; lat: number }; view?: { zoom: number; pan: { x: number; y: number } } } | null>(null)
