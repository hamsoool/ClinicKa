"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./utils";
import { buttonVariants } from "./button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-full p-3", className)}
      classNames={{
        months: "flex flex-col",
        month: "w-full space-y-4",
        caption: "relative flex items-center justify-center gap-2 pt-1",
        caption_label: "text-sm font-medium",
        caption_dropdowns: "flex items-center gap-2",
        dropdown: "h-8 rounded-md border border-input bg-background px-2 text-sm",
        dropdown_month: "h-8 rounded-md border border-input bg-background px-2 text-sm",
        dropdown_year: "h-8 rounded-md border border-input bg-background px-2 text-sm",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "border-b border-border/50",
        head_cell: "pb-2 text-center text-[0.78rem] font-medium text-muted-foreground",
        row: "border-b border-transparent last:border-b-0",
        cell: "relative h-11 p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 rounded-xl p-0 font-normal aria-selected:opacity-100",
        ),
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-40",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className: iconClassName, ...iconProps }) => (
          <ChevronLeft className={cn("h-4 w-4", iconClassName)} {...iconProps} />
        ),
        IconRight: ({ className: iconClassName, ...iconProps }) => (
          <ChevronRight className={cn("h-4 w-4", iconClassName)} {...iconProps} />
        ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
