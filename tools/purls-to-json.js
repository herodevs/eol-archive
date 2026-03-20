const { writeFileSync, existsSync, readdirSync, copyFileSync } = require('fs');
const { join } = require('path');
const { PackageURL } = require('packageurl-js');
// const semverRangeSubset = require('semver/ranges/subset');

var argv = require('minimist')(process.argv.slice(2));

const jsonFile = join(process.cwd(), argv.f || 'canonical-list.json');

if (!existsSync(jsonFile)) {
  console.error([
    `~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
    `\tERROR - file ${jsonFile} does not exist`,
    `~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
  ].join('\n')
  )
  return process.exit(1);
}

const backupAndWrite = (suffix, content) => {
  const cwd = process.cwd();
  const outFile = join(cwd, `registry-${suffix}.json`);
  const hasBackup = readdirSync(cwd).some(f => f.match(new RegExp(`^registry-${suffix}\\.previous\\.\\d+\\.json$`)));
  if (!hasBackup && existsSync(outFile)) {
    copyFileSync(outFile, join(cwd, `registry-${suffix}.previous.${Date.now()}.json`));
  }
  writeFileSync(outFile, content, { encoding: 'utf8' });
};

const getVersionURI = (ecosystem, packageName, version) => {
  switch (ecosystem.toLowerCase()) {
    case ('maven'): {
      return `https://central.sonatype.com/artifact/${packageName}/${version}`;
    }
    case ('npm'): {
      return `https://www.npmjs.com/package/${packageName}/v/${version}`
    }
    case ('cargo'): {
      return `https://crates.io/crates/${packageName}/${version}`
    }
    case ('gem'): {
      return `https://rubygems.org/gems/${packageName}/versions/${version}`
    }
    case ('nuget'): {
      return `https://www.nuget.org/packages/${packageName}/${version}`
    }
    case ('pypi'): {
      return `https://pypi.org/project/${packageName}/${version}`;
    }
    default: {
      return 'https://www.herodevs.com';
    }
  }
}

const convertPurlsToManufacturers = (suffix) => {
  const purls = require(jsonFile).purls
    .slice()
    .sort((a, b) => {
      const pa = typeof a === 'string' ? a : a.identifier;
      const pb = typeof b === 'string' ? b : b.identifier;
      return pa.localeCompare(pb);
    });

  const manufacturers = {};
  
  for (let entry of purls) {
    const purl = typeof entry === 'string' ? entry : entry.identifier;
    const eolFrom = typeof entry === 'string' ? null : entry.eolFrom;

    const {
      type,
      name,
      namespace,
      version,
      qualifiers,
      subpath
    } = PackageURL.fromString(purl);
  
    const componentName = type === 'npm' 
    ? [
        decodeURIComponent(namespace || ''),
        name
      ].filter(x => x).join('/')
    : name;
  
    manufacturers[type] = manufacturers[type] || {
      manufacturer: type,
      components: {}
    };
  
    manufacturers[type].components[componentName] = manufacturers[type].components[componentName] || {
      lifecycles: []
    };
  
    manufacturers[type].components[componentName].lifecycles.push({
      purl,
      eolField: 'isEol',
      range: version,
      isEol: true,
      isDefault: true,
      supportLevel: "STANDARD_SUPPORT",
      setEolAt: eolFrom != null
    });
  
  }
  
  const resultJson = [];
  for (let value of Object.values(manufacturers)) {
    resultJson.push({
      manufacturer: value.manufacturer,
      components: Object.keys(value.components).map((componentName) => {
        return {
          ...value.components[componentName].lifecycles[componentName],
          name: componentName,
          ecosystem: value.manufacturer,
          aliases: [],
          reference: '',
          lifecycles: value.components[componentName].lifecycles
        }
      })
    })
  }
  
  backupAndWrite(suffix, JSON.stringify(resultJson, null, 2));
}

const converPurlsToEOLDate = (suffix) => {
  const purls = require(jsonFile).purls
    .slice()
    .sort((a, b) => {
      const pa = typeof a === 'string' ? a : a.identifier;
      const pb = typeof b === 'string' ? b : b.identifier;
      return pa.localeCompare(pb);
    });

  const existingReleaseDates = {};
  const existingRegistryFile = join(process.cwd(), `registry-${suffix}.json`);
  if (existsSync(existingRegistryFile)) {
    for (const ecosystem of require(existingRegistryFile)) {
      for (const component of ecosystem.components) {
        for (const cycle of component.cycles) {
          if (cycle.purl && cycle.releaseDate) {
            existingReleaseDates[cycle.purl] = cycle.releaseDate;
          }
        }
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const ecosystems = {};

  for (let entry of purls) {
    const purl = typeof entry === 'string' ? entry : entry.identifier;
    const eolFrom = typeof entry === 'string' ? null : entry.eolFrom;

    const {
      type,
      name,
      namespace,
      version,
      // qualifiers,
      // subpath
    } = PackageURL.fromString(purl);

    const componentName = type === 'npm'
      ? [
          decodeURIComponent(namespace || ''),
          name
        ].filter(x => x).join('/')
      : name;

    const linkId = (type === 'maven' && namespace) ? `${namespace}/${name}` : componentName;

    ecosystems[type] = ecosystems[type] || {
      ecosystem: type,
      components: {}
    };
    
    ecosystems[type].components[componentName] = ecosystems[type].components[componentName] || {
      cycles: {}
    }

    ecosystems[type]
      .components[componentName]
      .cycles[version] = {
        purl,
        componentName,
        cycle: version,
        releaseDate: eolFrom ?? existingReleaseDates[purl] ?? today,
        setEolAt: eolFrom != null || existingReleaseDates[purl] != null,
        eol: true,
        latest: '',
        latestReleaseDate: '',
        link: getVersionURI(type, linkId, version),
        lts: false,
        support: '',
        extendedSupport: true
      }
  }

  const resultJson = [];
  for (let value of Object.values(ecosystems)) {
    resultJson.push({
      ecosystem: value.ecosystem,
      components: Object.values(value.components).map((component) => {
        const name = Object.values(component.cycles)[0].componentName;
        return {
          name,
          ecosystem: value.ecosystem,
          cycles: Object.values(component.cycles).map((cycle) => {
            delete cycle.componentName;
            return {
              ...cycle
            }
          })
        }
      })
    })
  }
  
    
  backupAndWrite(suffix, JSON.stringify(resultJson, null, 2));
}

switch (argv.o) {
  case ('e'): {
    converPurlsToEOLDate('e')
    return process.exit();
  }
  case ('m'):
  default: {
    convertPurlsToManufacturers('m')
    return process.exit();
  }
}
