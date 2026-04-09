type Props = {
  flightSize:number
  setFlightSize:(n:number)=>void

  algorithm:string
  setAlgorithm:(s:string)=>void

  useHistory:boolean
  setUseHistory:(b:boolean)=>void

  balanceWHS:boolean
  setBalanceWHS:(b:boolean)=>void

  generating:boolean
  flights:any[]

  handleGenerate:()=>void
  handleShuffle:()=>void
  saveFlights:()=>void
  deleteFlights:()=>void
}

export default function FlightOptions({
  flightSize,
  setFlightSize,
  algorithm,
  setAlgorithm,
  useHistory,
  setUseHistory,
  balanceWHS,
  setBalanceWHS,
  generating,
  flights,
  handleGenerate,
  handleShuffle,
  saveFlights,
  deleteFlights
}:Props){

  return(

    <div className="bg-white p-6 rounded-xl shadow mb-6">

      {/* Flight size */}

      <div className="mb-4">

        <label className="block text-sm mb-1">
          Flight size
        </label>

        <select
          value={flightSize}
          onChange={e=>setFlightSize(Number(e.target.value))}
          className="border p-2 rounded"
        >
          <option value={2}>2 players</option>
          <option value={3}>3 players</option>
          <option value={4}>4 players</option>
        </select>

      </div>

      {/* Algorithm */}

      <div className="mb-4">

        <label className="block text-sm mb-1">
          Algorithm
        </label>

        <select
          value={algorithm}
          onChange={e=>setAlgorithm(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="simple">Random</option>
          <option value="optimized">Optimized</option>
        </select>

      </div>

      {/* Options */}

      <div className="space-y-2">

        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={useHistory}
            onChange={e=>setUseHistory(e.target.checked)}
          />
          Avoid previous flights
        </label>

        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={balanceWHS}
            onChange={e=>setBalanceWHS(e.target.checked)}
          />
          Balance WHS
        </label>

      </div>

      {/* FLIGHT CONTROLS */}

      <div className="flex gap-4 mt-6">

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          {generating ? 'Generating…' : 'Generate flights'}
        </button>

        {flights.length>0 &&(

          <button
            onClick={deleteFlights}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            Delete flights
          </button>

        )}

        <button
          onClick={saveFlights}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Save flights
        </button>

        <button
          onClick={handleShuffle}
          className="bg-gray-600 text-white px-4 py-2 rounded"
        >
          Shuffle again
        </button>

      </div>

    </div>

  )

}