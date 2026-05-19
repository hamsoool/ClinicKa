import type { ReactNode } from 'react';
import { cn } from './ui/utils';

export type PortalPageIntroProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  headingClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  actionsClassName?: string;
};

export default function PortalPageIntro({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
  contentClassName,
  headingClassName,
  titleClassName,
  descriptionClassName,
  actionsClassName,
}: PortalPageIntroProps) {
  return (
    <div
      className={cn(
        'rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-[0_18px_60px_rgba(16,24,40,0.08)] backdrop-blur sm:p-8',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-end lg:justify-between',
          contentClassName,
        )}
      >
        <div className={cn('space-y-4', headingClassName)}>
          {eyebrow ? <div>{eyebrow}</div> : null}
          <div>
            <h1 className={cn('text-2xl font-bold tracking-tight text-on-surface sm:text-3xl', titleClassName)}>
              {title}
            </h1>
            {description ? (
              <p
                className={cn(
                  'mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base',
                  descriptionClassName,
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
          {children}
        </div>

        {actions ? <div className={cn('w-full lg:w-auto', actionsClassName)}>{actions}</div> : null}
      </div>
    </div>
  );
}
