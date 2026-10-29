import type { Offer } from "./api";

export const isListed = (what: string, offers: Offer[]) => {
  const wanted = what.trim().toLowerCase();
  if (wanted === "") return false;
  return offers.some((offer) => {
    const listed = offer.product.trim().toLowerCase();
    return listed !== "" && (listed.includes(wanted) || wanted.includes(listed));
  });
};
