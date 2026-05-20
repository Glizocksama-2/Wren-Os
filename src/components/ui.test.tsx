import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./ui";

function getPolylinePoints() {
  const sparkline = screen.getByRole("img", { name: "Trend" });
  const polyline = sparkline.querySelector("polyline");
  expect(polyline).toBeInTheDocument();
  return polyline?.getAttribute("points") ?? "";
}

function yValues(points: string) {
  return points.split(" ").map((point) => Number(point.split(",")[1]));
}

describe("Sparkline", () => {
  it("normalizes supplied data into the SVG coordinate space", () => {
    render(<Sparkline color="#123456" data={[0, 10, 5]} />);

    expect(getPolylinePoints()).toBe("2,34 60,2 118,18");
  });

  it("renders an honest flat trend when no data is supplied", () => {
    render(<Sparkline />);

    const values = yValues(getPolylinePoints());
    expect(new Set(values).size).toBe(1);
  });
});
