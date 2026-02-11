import { useParams } from 'react-router-dom';

export default function RecipeDetail() {
  const { id } = useParams();
  return (
    <div>
      <h1>Recipe: {id}</h1>
    </div>
  );
}
