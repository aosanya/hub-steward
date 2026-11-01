import { ListRow, Rows } from "./ListRow";

export type ProductLine = { id: string; name: string; shops: number; fromPrice: string };

const shopsWords = (count: number) => `${count} ${count === 1 ? "shop" : "shops"}`;

const priceWords = (shops: number, fromPrice: string) => (fromPrice ? `${shops > 1 ? "from " : ""}${fromPrice}` : "");

export const productMeta = (product: ProductLine) =>
  [shopsWords(product.shops), priceWords(product.shops, product.fromPrice)].filter(Boolean).join(" · ");

export function ProductRows({ products, onOpen }: { products: ProductLine[]; onOpen: (productId: string) => void }) {
  return (
    <Rows>
      {products.map((product) => (
        <ListRow key={product.id} title={product.name} meta={productMeta(product)} end="›" onClick={() => onOpen(product.id)} />
      ))}
    </Rows>
  );
}
