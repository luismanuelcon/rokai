import ar from 'flag-icons/flags/4x3/ar.svg';
import br from 'flag-icons/flags/4x3/br.svg';
import ca from 'flag-icons/flags/4x3/ca.svg';
import ch from 'flag-icons/flags/4x3/ch.svg';
import cl from 'flag-icons/flags/4x3/cl.svg';
import co from 'flag-icons/flags/4x3/co.svg';
import cr from 'flag-icons/flags/4x3/cr.svg';
import de from 'flag-icons/flags/4x3/de.svg';
import ec from 'flag-icons/flags/4x3/ec.svg';
import es from 'flag-icons/flags/4x3/es.svg';
import fr from 'flag-icons/flags/4x3/fr.svg';
import gb from 'flag-icons/flags/4x3/gb.svg';
import it from 'flag-icons/flags/4x3/it.svg';
import mx from 'flag-icons/flags/4x3/mx.svg';
import nl from 'flag-icons/flags/4x3/nl.svg';
import pa from 'flag-icons/flags/4x3/pa.svg';
import pe from 'flag-icons/flags/4x3/pe.svg';
import pt from 'flag-icons/flags/4x3/pt.svg';
import us from 'flag-icons/flags/4x3/us.svg';
import uy from 'flag-icons/flags/4x3/uy.svg';
import ve from 'flag-icons/flags/4x3/ve.svg';

/** Se importan solo los 21 países usados: el paquete trae 271 y no queremos empaquetarlos todos. */
export const FLAGS: Record<string, string> = {
  AR: ar,
  BR: br,
  CA: ca,
  CH: ch,
  CL: cl,
  CO: co,
  CR: cr,
  DE: de,
  EC: ec,
  ES: es,
  FR: fr,
  GB: gb,
  IT: it,
  MX: mx,
  NL: nl,
  PA: pa,
  PE: pe,
  PT: pt,
  US: us,
  UY: uy,
  VE: ve,
};
