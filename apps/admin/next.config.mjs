/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  transpilePackages: [
    "@tracking-connector/airbyte",
    "@tracking-connector/bigquery",
    "@tracking-connector/shared"
  ]
};

export default nextConfig;
