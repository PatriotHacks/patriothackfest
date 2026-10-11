import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { site } from "@/content/site"
import { appUrl } from "@/lib/env"

export function Roles() {
  return (
    <section
      id="roles"
      aria-labelledby="roles-heading"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16"
    >
      <h2 id="roles-heading" className="text-2xl font-semibold">
        Get involved
      </h2>
      <ul className="grid gap-4 sm:grid-cols-3">
        {site.roles.map((role) => (
          <li key={role.id} className="flex">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>
                  <h3>{role.title}</h3>
                </CardTitle>
                <CardDescription>{role.description}</CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                {site.event.applicationsOpen ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={appUrl}>Apply as {role.title.toLowerCase()}</a>
                  </Button>
                ) : (
                  <p className="text-muted-foreground">Opening soon</p>
                )}
              </CardFooter>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}
