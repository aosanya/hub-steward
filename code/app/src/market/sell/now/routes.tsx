import { Route } from "react-router-dom";
import { SalePage } from "./SalePage";
import { SellNowPage } from "./SellNowPage";
import { SellPage } from "./SellPage";
import { SellProductsPage } from "./SellProductsPage";

export const sellTile = { label: "Sell harvest", path: "/sell" };

export const sellNowRoutes = (
  <>
    <Route path="/sell" element={<SellProductsPage />} />
    <Route path="/sell/:productId" element={<SellPage />} />
    <Route path="/sell/:productId/now/:offerId" element={<SellNowPage />} />
    <Route path="/sell/sale/:saleId" element={<SalePage />} />
  </>
);
