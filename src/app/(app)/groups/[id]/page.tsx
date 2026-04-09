'use client'

import { useParams } from "next/navigation"
import Link from "next/link"

export default function GroupPage(){

  const params = useParams()
  const groupId = params.id as string

  return(

    <div className="p-6 space-y-4">

      <h1 className="text-2xl font-bold">
        Group
      </h1>

      <div className="flex flex-col gap-2">

        <Link
          href={`/groups/${groupId}/members`}
          className="text-blue-600"
        >
          Members
        </Link>

        <Link
          href={`/groups/${groupId}/events`}
          className="text-blue-600"
        >
          Events
        </Link>

        <Link
          href={`/groups/${groupId}/constraints`}
          className="text-blue-600"
        >
          Flight Constraints
        </Link>

      </div>

    </div>

  )

}