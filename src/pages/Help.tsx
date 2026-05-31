import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, FileText, BookOpen } from "lucide-react";
import guide from "@/data/userGuide.json";

type Persona = (typeof guide.personas)[number];

export default function Help() {
  const [tab, setTab] = useState<string>("overview");
  const personas = guide.personas as Persona[];

  return (
    <AppLayout>
      <div className="px-4 py-5 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> {guide.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{guide.subtitle} · {guide.version}</p>
          </div>
          <div className="flex gap-2">
            <a href="/Pepper_OS_User_Guide.pdf" download>
              <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1.5" /> PDF</Button>
            </a>
            <a href="/Pepper_OS_User_Guide.docx" download>
              <Button variant="outline" size="sm"><FileText className="h-3.5 w-3.5 mr-1.5" /> Word</Button>
            </a>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {personas.map(p => (
              <TabsTrigger key={p.key} value={p.key}>{p.name}</TabsTrigger>
            ))}
            <TabsTrigger value="modules">Modules</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-5">
            <section className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-base font-semibold text-foreground mb-2">What is Pepper OS?</h2>
              <p className="text-sm text-foreground/90 leading-relaxed">{guide.intro.what}</p>
            </section>
            <KvSection title="Navigation map" rows={guide.intro.navigation as [string, string][]} />
            <KvSection title="Things that work the same everywhere" rows={guide.intro.common as [string, string][]} />
          </TabsContent>

          {personas.map(p => (
            <TabsContent key={p.key} value={p.key} className="mt-4 space-y-5">
              <section className="bg-card border border-border rounded-xl p-4">
                <h2 className="text-base font-semibold text-foreground">{p.name}</h2>
                <p className="text-sm text-muted-foreground italic mt-1">{p.summary}</p>
              </section>

              <ListSection title="Your typical day" items={p.daily} ordered />

              <section className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">Modules you use</h3>
                <div className="space-y-4">
                  {p.modules.map(m => (
                    <div key={m.name}>
                      <h4 className="text-sm font-semibold text-foreground mb-1.5">{m.name}</h4>
                      <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                        {m.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid md:grid-cols-2 gap-4">
                <ListSection title="What you can do" items={p.cans} tone="positive" />
                <ListSection title="What you can't do" items={p.cants} tone="destructive" />
              </div>

              {p.faq?.length > 0 && (
                <section className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">FAQ</h3>
                  <dl className="space-y-3">
                    {p.faq.map(([q, a], i) => (
                      <div key={i}>
                        <dt className="text-sm font-semibold text-foreground">Q. {q}</dt>
                        <dd className="text-sm text-foreground/90 mt-1">A. {a}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </TabsContent>
          ))}

          <TabsContent value="modules" className="mt-4 space-y-4">
            {guide.appendix.modules.map(m => (
              <section key={m.name} className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground">{m.name}</h3>
                <p className="text-sm text-foreground/90 mt-1 leading-relaxed">{m.blurb}</p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-foreground/90">
                  {m.tips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </section>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function KvSection({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <h3 className="text-sm font-semibold text-foreground px-4 py-2.5 border-b border-border bg-secondary/30">{title}</h3>
      <dl className="divide-y divide-border">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[180px_1fr] gap-3 px-4 py-2.5">
            <dt className="text-sm font-medium text-primary">{k}</dt>
            <dd className="text-sm text-foreground/90">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ListSection({ title, items, ordered, tone }: { title: string; items: string[]; ordered?: boolean; tone?: "positive" | "destructive" }) {
  const toneClass = tone === "positive" ? "text-emerald-600" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <section className="bg-card border border-border rounded-xl p-4">
      <h3 className={`text-sm font-semibold uppercase tracking-wider mb-2 ${toneClass}`}>{title}</h3>
      {ordered ? (
        <ol className="list-decimal pl-5 space-y-1 text-sm text-foreground/90">{items.map((s, i) => <li key={i}>{s}</li>)}</ol>
      ) : (
        <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
      )}
    </section>
  );
}