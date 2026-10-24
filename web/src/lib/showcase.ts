import type { PhotoKey } from './images';

export interface ShowcaseItem {
  name: string;
  unit: string;
  retail: number;
  wholesale: number;
  min: number;
  emoji: string;
  photo: PhotoKey;
  hrs: number;
}

/** Sample shelf shown on the website (the live prices come from the farms in the real app). */
export const SHOWCASE: ShowcaseItem[] = [
  { name: 'Vine Tomatoes', unit: 'kg', retail: 3500, wholesale: 2600, min: 10, emoji: '🍅', photo: 'tomato', hrs: 12 },
  { name: 'Sweet Carrots', unit: 'kg', retail: 2800, wholesale: 2000, min: 10, emoji: '🥕', photo: 'carrot', hrs: 10 },
  { name: 'Ripe Bananas', unit: 'kg', retail: 2200, wholesale: 1500, min: 15, emoji: '🍌', photo: 'banana', hrs: 18 },
  { name: 'Baby Spinach', unit: 'bunch', retail: 1000, wholesale: 700, min: 20, emoji: '🥬', photo: 'spinach', hrs: 6 },
  { name: 'Sweet Mangoes', unit: 'kg', retail: 4500, wholesale: 3300, min: 15, emoji: '🥭', photo: 'mango', hrs: 8 },
  { name: 'Red Onions', unit: 'kg', retail: 3000, wholesale: 2200, min: 25, emoji: '🧅', photo: 'onion', hrs: 20 },
  { name: 'Hass Avocados', unit: 'kg', retail: 6500, wholesale: 5000, min: 10, emoji: '🥑', photo: 'avocado', hrs: 15 },
  { name: 'Golden Pineapples', unit: 'piece', retail: 3000, wholesale: 2200, min: 12, emoji: '🍍', photo: 'pineapple', hrs: 26 },
];
