import { LayoutTemplate, Share2, Shapes, Sparkles, Type, Users, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

import { LANDING_COPY, type FeatureId } from './copy';

// Icons are keyed here (not in `copy.ts`) so the Playwright spec can import the copy as pure data.
const ICONS: Record<FeatureId, LucideIcon> = {
  collaboration: Users,
  shapes: Shapes,
  text: Type,
  templates: LayoutTemplate,
  sharing: Share2,
  ai: Sparkles,
};

// Flat card (no CardHeader/CardContent): their long default class lists are serialised twice (HTML and the flight
// payload) and would push the document past the 40 KB budget (FR-014).
export function FeatureGrid(): React.JSX.Element {
  return (
    <section aria-labelledby="features-heading" className="py-16">
      <h2 id="features-heading" className="text-2xl font-semibold text-copy-primary">
        {LANDING_COPY.featuresHeading}
      </h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LANDING_COPY.features.map((feature) => {
          const Icon = ICONS[feature.id];
          return (
            <Card key={feature.id} className="gap-3 rounded-2xl border-surface-border bg-surface px-5 py-5">
              <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
              <h3 className="font-semibold text-copy-primary">{feature.title}</h3>
              {feature.comingSoon ? (
                <Badge variant="outline" className="self-start text-copy-secondary">
                  {LANDING_COPY.comingSoon}
                </Badge>
              ) : null}
              <p className="text-sm text-copy-secondary">{feature.body}</p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
