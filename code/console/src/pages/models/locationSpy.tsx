import { screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";

export function LocationSpy() {
  const { pathname, search } = useLocation();
  return <p data-testid="location">{pathname + search}</p>;
}

export const currentAddress = () => screen.getByTestId("location").textContent;
