import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateInput } from "./DateInput";

describe("DateInput", () => {
  afterEach(cleanup);
  it("normalizes continuous typing and returns an ISO business date", () => {
    const onChange = vi.fn();
    render(<DateInput label="วันฟัก" onChange={onChange} />);
    const input = screen.getByLabelText("วันฟัก");
    fireEvent.change(input, { target: { value: "01122026" } });
    expect((input as HTMLInputElement).value).toBe("01/12/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-12-01");
  });
  it("inserts separators while typing and normalizes a single-digit day and month on commit", () => {
    const onChange = vi.fn();
    render(<DateInput label="วันที่" onChange={onChange} />);
    const input = screen.getByLabelText("วันที่") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0109" } });
    expect(input.value).toBe("01/09");
    fireEvent.change(input, { target: { value: "01092026" } });
    expect(input.value).toBe("01/09/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-09-01");
    fireEvent.change(input, { target: { value: "1/9/2026" } });
    fireEvent.blur(input);
    expect(input.value).toBe("01/09/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-09-01");
  });
  it("rejects impossible dates and accepts picker selection", () => {
    const onChange = vi.fn();
    const { container } = render(<DateInput label="วันที่จอง" onChange={onChange} />);
    const input = screen.getByLabelText("วันที่จอง");
    fireEvent.change(input, { target: { value: "31022026" } });
    expect(screen.getByRole("alert").textContent).toBe("กรุณากรอกวันที่ที่มีอยู่จริง");
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "2028-02-29" } });
    expect((input as HTMLInputElement).value).toBe("29/02/2028");
    expect(onChange).toHaveBeenLastCalledWith("2028-02-29");
  });
  it.each(["31022026","32012026","29022025"])("rejects invalid real date %s", value => {
    const onChange = vi.fn();
    render(<DateInput label="วันที่" onChange={onChange} />);
    const input=screen.getByLabelText("วันที่");
    fireEvent.change(input,{target:{value}});
    fireEvent.blur(input);
    expect(screen.getByRole("alert").textContent).toBe("กรุณากรอกวันที่ที่มีอยู่จริง");
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    expect((input as HTMLInputElement).checkValidity()).toBe(false);
  });
  it("accepts a leap-year date and rejects partial input on commit", () => {
    const onChange = vi.fn();
    render(<DateInput label="วันที่" onChange={onChange} />);
    const input=screen.getByLabelText("วันที่") as HTMLInputElement;
    fireEvent.change(input,{target:{value:"29022028"}});
    expect(input.value).toBe("29/02/2028");
    expect(onChange).toHaveBeenLastCalledWith("2028-02-29");
    fireEvent.change(input,{target:{value:"2902"}});
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
  it("enforces required fields, allows optional empty fields, and keeps keyboard entry enabled", () => {
    const requiredChange=vi.fn(),optionalChange=vi.fn();
    const {rerender}=render(<DateInput label="วันที่บังคับ" required onChange={requiredChange}/>);
    const required=screen.getByLabelText("วันที่บังคับ") as HTMLInputElement;
    expect(required.required).toBe(true);
    expect(required.readOnly).toBe(false);
    expect(required.disabled).toBe(false);
    expect(required.checkValidity()).toBe(false);
    rerender(<DateInput label="วันที่ไม่บังคับ" onChange={optionalChange}/>);
    const optional=screen.getByLabelText("วันที่ไม่บังคับ") as HTMLInputElement;
    fireEvent.change(optional,{target:{value:""}});
    fireEvent.blur(optional);
    expect(optional.checkValidity()).toBe(true);
    expect(optionalChange).toHaveBeenLastCalledWith(undefined);
  });
  it("renders a visible calendar button that opens the picker", () => {
    const showPicker=vi.fn();
    render(<DateInput label="วันที่นัดหมาย" onChange={vi.fn()}/>);
    const button=screen.getByRole("button",{name:"Open calendar for วันที่นัดหมาย"});
    const picker=document.querySelector('input[type="date"]') as HTMLInputElement & {showPicker?:()=>void};
    picker.showPicker=showPicker;
    expect(button.hasAttribute("hidden")).toBe(false);
    fireEvent.click(button);
    expect(showPicker).toHaveBeenCalledTimes(1);
  });
});
