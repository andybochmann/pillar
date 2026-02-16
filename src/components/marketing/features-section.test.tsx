import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeaturesSection } from "./features-section";

describe("FeaturesSection", () => {
  it("renders section heading", () => {
    render(<FeaturesSection />);

    expect(
      screen.getByRole("heading", { name: /everything you need/i }),
    ).toBeInTheDocument();
  });

  it("renders all four feature cards", () => {
    render(<FeaturesSection />);

    expect(screen.getByText("Kanban Boards")).toBeInTheDocument();
    expect(screen.getByText("Team Collaboration")).toBeInTheDocument();
    expect(screen.getByText("Works Offline")).toBeInTheDocument();
    expect(screen.getByText("Real-time Sync")).toBeInTheDocument();
  });

  it("renders feature descriptions", () => {
    render(<FeaturesSection />);

    expect(screen.getByText(/drag-and-drop task management/i)).toBeInTheDocument();
    expect(screen.getByText(/share projects with your team/i)).toBeInTheDocument();
    expect(screen.getByText(/full pwa support/i)).toBeInTheDocument();
    expect(screen.getByText(/live updates across all your devices/i)).toBeInTheDocument();
  });
});
