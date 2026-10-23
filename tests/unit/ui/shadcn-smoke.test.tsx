import { existsSync, readFileSync } from 'node:fs';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const COMPONENTS = [
  'button',
  'card',
  'dialog',
  'input',
  'textarea',
  'tabs',
  'scroll-area',
  'tooltip',
  'dropdown-menu',
  'avatar',
  'badge',
];

describe('shadcn/ui initial set (AC-004)', () => {
  it('has components.json pointing at app/globals.css with the project aliases', () => {
    const config = JSON.parse(readFileSync('components.json', 'utf8')) as {
      rsc: boolean;
      tsx: boolean;
      tailwind: { css: string; cssVariables: boolean };
      aliases: Record<string, string>;
      iconLibrary: string;
    };
    expect(config).toMatchObject({
      rsc: true,
      tsx: true,
      tailwind: { css: 'app/globals.css', cssVariables: true },
      aliases: { components: '@/components', ui: '@/components/ui', utils: '@/lib/utils', hooks: '@/hooks' },
      iconLibrary: 'lucide',
    });
  });

  it.each(COMPONENTS)('generated components/ui/%s.tsx exists', (name) => {
    expect(existsSync(`components/ui/${name}.tsx`)).toBe(true);
  });

  it('renders every primitive inside TooltipProvider without throwing', () => {
    render(
      <TooltipProvider>
        <Button>Action</Button>
        <Card>
          <CardHeader>
            <CardTitle>Card title</CardTitle>
            <CardDescription>Card description</CardDescription>
          </CardHeader>
          <CardContent>Card body</CardContent>
          <CardFooter>Card footer</CardFooter>
        </Card>
        <Input aria-label="Name" />
        <Textarea aria-label="Notes" />
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Tab A</TabsTrigger>
            <TabsTrigger value="b">Tab B</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Panel A</TabsContent>
          <TabsContent value="b">Panel B</TabsContent>
        </Tabs>
        <ScrollArea className="h-10">Scrollable</ScrollArea>
        <Tooltip open>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tip text</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Avatar>
          <AvatarImage src="" alt="" />
          <AvatarFallback>DA</AvatarFallback>
        </Avatar>
        <Badge>New</Badge>
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog title</DialogTitle>
              <DialogDescription>Dialog description</DialogDescription>
            </DialogHeader>
            <DialogFooter>Dialog footer</DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>,
    );
    // The open modal dialog hides its siblings from the accessibility tree.
    expect(screen.getByRole('button', { name: 'Action', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tab A', hidden: true })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('dialog', { name: 'Dialog title' })).toBeInTheDocument();
    expect(screen.getAllByText('Tip text').length).toBeGreaterThan(0);
    expect(screen.getByText('DA')).toBeInTheDocument();
  });
});
