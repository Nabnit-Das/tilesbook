import { str, n, type Row } from "./model";
export interface CatalogueItem {
  id: string;
  name: string;
  brand: string;
  design: string;
  size: string;
  finish: string;
  category: string;
  unit: string;
  price: number;
  photo: string;
}
export function catalogueItems(
  records: Row[],
  search = "",
  category = "",
): CatalogueItem[] {
  const term = search.trim().toLowerCase();
  return records
    .filter(
      (r) =>
        (!category || str(r, "category") === category) &&
        ["name", "brand", "design", "size", "finish", "category"].some((k) =>
          str(r, k).toLowerCase().includes(term),
        ),
    )
    .map((r) => ({
      id: r.id,
      name: str(r, "name"),
      brand: str(r, "brand"),
      design: str(r, "design"),
      size: str(r, "size"),
      finish: str(r, "finish"),
      category: str(r, "category"),
      unit: str(r, "baseUnit"),
      price: n(r, "salePrice"),
      photo: str(r, "photo"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function cataloguePhoto(
  value: string,
  firm: string,
): { data?: string; file?: string } {
  if (
    /^data:image\/(jpeg|png);base64,[A-Za-z\d+/=]+$/.test(value) &&
    value.length <= 1400000
  )
    return { data: value };
  const path = value.match(
    /^\/api\/media\/lot-photos\/([a-f\d-]{36})\/([a-f\d-]{36}\.jpg)$/i,
  );
  return path && path[1] === firm ? { file: path[2] } : {};
}
export const productLibrary = [
  {
    key: "libraryPorcelain",
    size: "600 × 600 mm",
    baseUnit: "Box",
    sqftPerPiece: 3.875,
    piecesPerBox: 4,
    hsn: "6907",
    gstRate: 18,
  },
  {
    key: "libraryWall",
    size: "300 × 450 mm",
    baseUnit: "Box",
    sqftPerPiece: 1.453,
    piecesPerBox: 6,
    hsn: "6907",
    gstRate: 18,
  },
  {
    key: "libraryGloss",
    size: "600 × 1200 mm",
    baseUnit: "Box",
    sqftPerPiece: 7.75,
    piecesPerBox: 2,
    hsn: "6907",
    gstRate: 18,
  },
  {
    key: "libraryAdhesive",
    size: "20 kg",
    baseUnit: "Bag",
    sqftPerPiece: 0,
    piecesPerBox: 1,
    hsn: "",
    gstRate: 18,
  },
  {
    key: "libraryBasin",
    size: "",
    baseUnit: "Piece",
    sqftPerPiece: 0,
    piecesPerBox: 1,
    hsn: "6910",
    gstRate: 18,
  },
  {
    key: "libraryMarble",
    size: "",
    baseUnit: "Slab",
    sqftPerPiece: 0,
    piecesPerBox: 1,
    hsn: "",
    gstRate: 18,
  },
] as const;
