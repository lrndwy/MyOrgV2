import { Suspense } from "react"
import { LoginForm } from "@/components/login-form"
import { Skeleton } from "@/components/ui/skeleton"

function LoginFormFallback() {
  return <Skeleton className="h-64 w-full" />
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  )
}
