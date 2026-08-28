import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateInput } from "./DateInput";

describe("DateInput", () => {
  it("normalizes continuous typing and returns an ISO business date", () => {
    const onChange = vi.fn();
    render(<DateInput label="วันฟัก" onChange={onChange} />);
    const input = screen.getByLabelText("วันฟัก");
    fireEvent.change(input, { target: { value: "01122026" } });
    expect((input as HTMLInputElement).value).toBe("01/12/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-01-12");
  });
  it("rejects impossible dates and accepts picker selection", () => {
    const onChange = vi.fn();
    const { container } = render(<DateInput label="วันที่จอง" onChange={onChange} />);
    const input = screen.getByLabelText("วันที่จอง");
    fireEvent.change(input, { target: { value: "02312026" } });
    expect(screen.getByRole("alert").textContent).toBe("กรุณากรอกวันที่ที่มีอยู่จริง");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "2028-02-29" } });
    expect((input as HTMLInputElement).value).toBe("02/29/2028");
    expect(onChange).toHaveBeenLastCalledWith("2028-02-29");
  });
});
