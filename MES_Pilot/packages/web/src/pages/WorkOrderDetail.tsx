import { useParams } from 'react-router-dom';

export default function WorkOrderDetail() {
  const { id } = useParams();
  return (
    <div>
      <h1>Work Order: {id}</h1>
    </div>
  );
}
