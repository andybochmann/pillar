import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, it, expect } from "vitest"
import { PasswordInput } from "./password-input"

describe("PasswordInput", () => {
  it("renders with password hidden by default", () => {
    render(<PasswordInput placeholder="Enter password" />)
    const input = screen.getByPlaceholderText("Enter password")
    expect(input).toHaveAttribute("type", "password")
  })

  it("toggles password visibility when button is clicked", async () => {
    const user = userEvent.setup()
    render(<PasswordInput placeholder="Enter password" />)

    const input = screen.getByPlaceholderText("Enter password")
    const toggleButton = screen.getByRole("button", { name: /show password/i })

    // Initially hidden
    expect(input).toHaveAttribute("type", "password")

    // Click to show
    await user.click(toggleButton)
    expect(input).toHaveAttribute("type", "text")
    expect(toggleButton).toHaveAccessibleName(/hide password/i)

    // Click to hide again
    await user.click(toggleButton)
    expect(input).toHaveAttribute("type", "password")
    expect(toggleButton).toHaveAccessibleName(/show password/i)
  })

  it("preserves input value when toggling visibility", async () => {
    const user = userEvent.setup()
    render(<PasswordInput placeholder="Enter password" />)

    const input = screen.getByPlaceholderText("Enter password")
    const toggleButton = screen.getByRole("button", { name: /show password/i })

    // Type a password
    await user.type(input, "MySecretPass123")
    expect(input).toHaveValue("MySecretPass123")

    // Toggle visibility
    await user.click(toggleButton)
    expect(input).toHaveValue("MySecretPass123")

    // Toggle back
    await user.click(toggleButton)
    expect(input).toHaveValue("MySecretPass123")
  })

  it("toggle button has proper aria-label", () => {
    render(<PasswordInput />)
    const toggleButton = screen.getByRole("button", { name: /show password/i })
    expect(toggleButton).toBeInTheDocument()
    expect(toggleButton).toHaveAccessibleName("Show password")
  })

  it("forwards all input props correctly", () => {
    render(
      <PasswordInput
        placeholder="Test placeholder"
        id="test-id"
        name="test-name"
        required
        autoComplete="current-password"
        className="custom-class"
      />
    )

    const input = screen.getByPlaceholderText("Test placeholder")
    expect(input).toHaveAttribute("id", "test-id")
    expect(input).toHaveAttribute("name", "test-name")
    expect(input).toBeRequired()
    expect(input).toHaveAttribute("autocomplete", "current-password")
    expect(input).toHaveClass("custom-class")
  })

  it("supports disabled state", () => {
    render(<PasswordInput disabled placeholder="Enter password" />)

    const input = screen.getByPlaceholderText("Enter password")
    const toggleButton = screen.getByRole("button", { name: /show password/i })

    expect(input).toBeDisabled()
    expect(toggleButton).toBeDisabled()
  })
})
