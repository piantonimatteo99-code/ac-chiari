import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

// Capitalize first letter of text input value
function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Types that should NOT be auto-capitalized (email, password, url, search behave differently)
const NO_CAPITALIZE_TYPES = ['email', 'password', 'url', 'date', 'number', 'tel'];
// Auto-capitalize only applies to plain text inputs
const shouldCapitalize = (type: string | undefined) =>
  !type || (!NO_CAPITALIZE_TYPES.includes(type));

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onChange, ...props }, ref) => {
    const isText = shouldCapitalize(type as string);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isText && e.target.value) {
        const capitalized = capitalizeFirst(e.target.value);
        if (capitalized !== e.target.value) {
          // mutate nativeInputValueSetter to avoid React synthetic event issues
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
          )?.set;
          nativeInputValueSetter?.call(e.target, capitalized);
          e.target.dispatchEvent(new Event('input', { bubbles: true }));
          // reconstruct synthetic event with new value
          const newEvent = Object.create(e);
          Object.defineProperty(newEvent, 'target', {
            writable: false,
            value: Object.assign(e.target, { value: capitalized }),
          });
          onChange?.(newEvent as React.ChangeEvent<HTMLInputElement>);
          return;
        }
      }
      onChange?.(e);
    };

    return (
      <input
        type={type}
        autoCapitalize={isText ? 'sentences' : 'none'}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&[type=date]]:appearance-none [&[type=date]]:h-10 [&[type=date]]:py-2 [&[type=date]]:leading-tight",
          className
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
