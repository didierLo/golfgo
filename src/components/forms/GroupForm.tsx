"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
const supabase = createClient()

export default function GroupForm() {

  const [name,setName] = useState("")

  const handleSubmit = async (e:any) => {

    e.preventDefault()

    const { error } = await supabase
      .from("groups")
      .insert([{ name }])

    if(error){
      alert(error.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md">

      <input
        value={name}
        onChange={(e)=>setName(e.target.value)}
        placeholder="Group name"
        className="border p-2"
      />

      <button className="bg-blue-600 text-white p-2 rounded">
        Add Group
      </button>

    </form>
  )
}