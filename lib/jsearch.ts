interface JSearchResponse {
  status: string;
  data: Array<{
    job_id: string;
    job_title: string;
    employer_name: string;
    job_city?: string | null;
    job_country?: string | null;
    job_employment_type?: string | null;
    job_apply_link: string;
    job_description?: string;
    job_posted_at_datetime_utc?: string;
  }>;
}

export async function searchJobs(query: string, country = "us", numPages = 1) {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST || "jsearch.p.rapidapi.com";
  if (!key) throw new Error("RAPIDAPI_KEY not set");

  const url = new URL(`https://${host}/search-v2`);
  url.searchParams.set("query", query);
  url.searchParams.set("num_pages", String(numPages));
  url.searchParams.set("country", country);
  url.searchParams.set("date_posted", "month");

  const res = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-host": host,
      "x-rapidapi-key": key,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`JSearch failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as JSearchResponse;
  return json.data ?? [];
}
