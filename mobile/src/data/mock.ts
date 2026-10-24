// Shown when backend env vars aren't set yet, so the UI is explorable immediately.
// Swap URLs for your own hosted, high-resolution photos (e.g. Supabase Storage).
import { Product, Promo } from '../types';

const img = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const base: Omit<Product, 'id'>[] = [
  { name: 'Vine Tomatoes', category: 'Vegetables', unit: 'kg', retail_price: 3500, wholesale_price: 2600, wholesale_min_qty: 10, stock: 120, image_url: img('photo-1592924357228-91a4daadcfea'), harvested_at: '' },
  { name: 'Sweet Carrots', category: 'Vegetables', unit: 'kg', retail_price: 2800, wholesale_price: 2000, wholesale_min_qty: 10, stock: 90, image_url: img('photo-1598170845058-32b9d6a5da37'), harvested_at: '' },
  { name: 'Spinach Bunch', category: 'Leafy', unit: 'bunch', retail_price: 1000, wholesale_price: 700, wholesale_min_qty: 20, stock: 200, image_url: img('photo-1576045057995-568f588f82fb'), harvested_at: '' },
  { name: 'Ripe Bananas', category: 'Fruit', unit: 'kg', retail_price: 2200, wholesale_price: 1500, wholesale_min_qty: 15, stock: 150, image_url: img('photo-1571771894821-ce9b6c11b08e'), harvested_at: '' },
  { name: 'Red Onions', category: 'Vegetables', unit: 'kg', retail_price: 3000, wholesale_price: 2200, wholesale_min_qty: 25, stock: 300, image_url: img('photo-1618512496248-a07fe83aa8cb'), harvested_at: '' },
  { name: 'Juicy Oranges', category: 'Fruit', unit: 'kg', retail_price: 2500, wholesale_price: 1800, wholesale_min_qty: 20, stock: 180, image_url: img('photo-1547514701-42782101795e'), harvested_at: '' },
  { name: 'Green Peppers', category: 'Vegetables', unit: 'kg', retail_price: 4000, wholesale_price: 3000, wholesale_min_qty: 10, stock: 60, image_url: img('photo-1563565375-f3fdfdbefa83'), harvested_at: '' },
  { name: 'Sweet Mangoes', category: 'Fruit', unit: 'kg', retail_price: 4500, wholesale_price: 3300, wholesale_min_qty: 15, stock: 80, image_url: img('photo-1553279768-865429fa0078'), harvested_at: '' },
];

export const mockProducts = (page: number): Product[] =>
  base.map((p, i) => ({
    ...p,
    id: `mock-${page}-${i}`,
    harvested_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
  }));

export const mockPromos: Promo[] = [
  { id: 'p1', kind: 'farm_box', title: 'Weekly Fresh Farm Box', subtitle: '12 seasonal items · TSh 35,000', image_url: img('photo-1542838132-92c53300491e', 1200) },
  { id: 'p2', kind: 'cooking_kit', title: "Chef's Pilau Cooking Kit", subtitle: 'Everything for dinner tonight', image_url: img('photo-1488459716781-31db52582fe9', 1200) },
  { id: 'p3', kind: 'farm_box', title: 'Family Veggie Crate', subtitle: 'Feeds 4 for a week', image_url: img('photo-1610348725531-843dff563e2c', 1200) },
];
