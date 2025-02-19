rm -rf ../_output

# Generate template output for inspection
helm template postgresql-backup-s3 ./ --values ./values.yaml --output-dir ./_output

# Verify chart formatting and dependencies
helm lint ./chart

# Perform a dry run of the installation
helm install --dry-run postgresql-backup-s3 ./ --values ./values.yaml --namespace default

# Package the chart
helm package ./

# Generate Helm repository index
helm repo index ./
