'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onChange, ...props }, ref) => {
    const handleInputChange = (
      event: React.ChangeEvent<HTMLTextAreaElement>
    ) => {
      // First, let the parent component's onChange handler do its thing
      if (onChange) {
        onChange(event);
      }
      // Then, adjust the height
      const textarea = event.target;
      textarea.style.height = 'auto'; // Reset height to recalculate
      textarea.style.height = `${textarea.scrollHeight}px`; // Set to scroll height
    };

    // Adjust height on initial render and when value changes externally
    React.useLayoutEffect(() => {
      const textarea = (ref as React.RefObject<HTMLTextAreaElement>)?.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, [props.value, ref]);


    return (
      <textarea
        className={cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          'resize-none overflow-hidden', // Important for auto-sizing
          className
        )}
        ref={ref}
        onChange={handleInputChange}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
