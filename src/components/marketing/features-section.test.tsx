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

  it("renders all ten feature cards", () => {
    render(<FeaturesSection />);

    expect(screen.getByText("Kanban Boards")).toBeInTheDocument();
    expect(screen.getByText("Team Collaboration")).toBeInTheDocument();
    expect(screen.getByText("Rich Notes")).toBeInTheDocument();
    expect(screen.getByText("Time Tracking")).toBeInTheDocument();
    expect(screen.getByText("Calendar View")).toBeInTheDocument();
    expect(screen.getByText("Push Notifications")).toBeInTheDocument();
    expect(screen.getByText("Command Palette")).toBeInTheDocument();
    expect(screen.getByText("AI Subtasks")).toBeInTheDocument();
    expect(screen.getByText("Works Offline")).toBeInTheDocument();
    expect(screen.getByText("Real-time Sync")).toBeInTheDocument();
  });

  it("renders feature descriptions", () => {
    render(<FeaturesSection />);

    expect(screen.getByText(/drag-and-drop task management/i)).toBeInTheDocument();
    expect(screen.getByText(/share projects with role-based access/i)).toBeInTheDocument();
    expect(screen.getByText(/markdown notes at every level/i)).toBeInTheDocument();
    expect(screen.getByText(/built-in stopwatch/i)).toBeInTheDocument();
    expect(screen.getByText(/day and week views/i)).toBeInTheDocument();
    expect(screen.getByText(/reminders with action buttons/i)).toBeInTheDocument();
    expect(screen.getByText(/instantly search tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/generate subtask breakdowns/i)).toBeInTheDocument();
    expect(screen.getByText(/full pwa support/i)).toBeInTheDocument();
    expect(screen.getByText(/live updates across all your devices/i)).toBeInTheDocument();
  });
});
