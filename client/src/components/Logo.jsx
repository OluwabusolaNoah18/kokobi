import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function Logo({ asLink = true }) {
  const img = <img src={logo} alt="Kokobi+" width="544" height="198" />;
  return asLink ? (
    <Link className="logo" to="/" aria-label="Kokobi+ home">{img}</Link>
  ) : (
    <div className="logo">{img}</div>
  );
}
